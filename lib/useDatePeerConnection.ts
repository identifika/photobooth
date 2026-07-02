"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SignalMsg =
  | { type: "peer-joined"; peer_id: string }
  | { type: "peer-left"; peer_id: string }
  | { type: "offer"; sdp: string; to: string; from?: string }
  | { type: "answer"; sdp: string; to: string; from?: string }
  | { type: "ice-candidate"; candidate: RTCIceCandidateInit; to: string; from?: string }
  | { type: "sync"; payload: unknown; to: string; from?: string }
  | { type: "room-full" };

export type ConnectionStatus =
  | "idle"
  | "waiting-for-peer"
  | "connecting"
  | "connected"
  | "room-full"
  | "peer-left"
  | "error";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  // Add a TURN server for reliability behind restrictive NATs/VPNs —
  // STUN alone will fail for a meaningful slice of real users.
  // { urls: "turn:your-turn-host:3478", username: "...", credential: "..." },
];

export function useDatePeerConnection(opts: {
  signalUrl: string; // e.g. wss://relay.yourapp.com
  roomId: string;
  peerId: string;
  isInitiator?: boolean;
  onSync?: (payload: unknown) => void;
}) {
  const { signalUrl, roomId, peerId, isInitiator, onSync } = opts;

  const onSyncRef = useRef(onSync);
  useEffect(() => {
    onSyncRef.current = onSync;
  }, [onSync]);

  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const remotePeerIdRef = useRef<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const send = useCallback((msg: SignalMsg) => {
    wsRef.current?.send(JSON.stringify(msg));
  }, []);

  const sendSync = useCallback(
    (payload: unknown) => {
      const str = JSON.stringify(payload);
      const CHUNK_SIZE = 16000;
      
      // If the message is small, just send it directly
      if (str.length < CHUNK_SIZE) {
        if (dcRef.current?.readyState === "open") {
          dcRef.current.send(str);
        } else if (remotePeerIdRef.current) {
          send({ type: "sync", payload, to: remotePeerIdRef.current, from: peerId });
        }
        return;
      }

      // Otherwise, chunk it to avoid WebRTC message size limits (typically 64KB)
      const id = Math.random().toString(36).substring(2, 9);
      const total = Math.ceil(str.length / CHUNK_SIZE);
      
      for (let i = 0; i < total; i++) {
        const chunkPayload = {
          _chunked: true,
          id,
          i,
          total,
          data: str.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
        };
        
        if (dcRef.current?.readyState === "open") {
          dcRef.current.send(JSON.stringify(chunkPayload));
        } else if (remotePeerIdRef.current) {
          send({ type: "sync", payload: chunkPayload, to: remotePeerIdRef.current, from: peerId });
        }
      }
    },
    [send, peerId]
  );

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
        audio: true,
      });
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && "contentHint" in videoTrack) {
        videoTrack.contentHint = "detail"; // prioritize resolution over framerate for photobooth
      }
      
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && remotePeerIdRef.current) {
          send({
            type: "ice-candidate",
            candidate: event.candidate.toJSON(),
            to: remotePeerIdRef.current,
            from: peerId,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") setStatus("connected");
        if (pc.connectionState === "failed") setStatus("error");
      };

      const chunkBuffers: Record<string, { total: number, chunks: string[] }> = {};

      const handlePayload = (payload: any) => {
        if (payload && payload._chunked) {
          const { id, i, total, data } = payload;
          if (!chunkBuffers[id]) {
            chunkBuffers[id] = { total, chunks: new Array(total) };
          }
          chunkBuffers[id].chunks[i] = data;
          
          // Check if complete
          let isComplete = true;
          for (let j = 0; j < total; j++) {
            if (chunkBuffers[id].chunks[j] === undefined) {
              isComplete = false;
              break;
            }
          }
          
          if (isComplete) {
            const fullStr = chunkBuffers[id].chunks.join("");
            delete chunkBuffers[id];
            try {
              onSyncRef.current?.(JSON.parse(fullStr));
            } catch (err) {
              console.error("Failed to parse chunked message", err);
            }
          }
        } else {
          onSyncRef.current?.(payload);
        }
      };

      // The initiator creates the data channel; the other side receives it via ondatachannel.
      const dc = pc.createDataChannel("sync");
      dcRef.current = dc;
      dc.onmessage = (e) => {
        try {
          handlePayload(JSON.parse(e.data));
        } catch (err) {
          console.error("Error parsing dc message", err);
        }
      };
      pc.ondatachannel = (event) => {
        dcRef.current = event.channel;
        event.channel.onmessage = (e) => {
          try {
            handlePayload(JSON.parse(e.data));
          } catch (err) {
            console.error("Error parsing dc message", err);
          }
        };
      };

      const ws = new WebSocket(`${signalUrl}/ws/${roomId}/${peerId}`);
      wsRef.current = ws;
      setStatus("waiting-for-peer");

      const iceQueue: RTCIceCandidateInit[] = [];

      ws.onmessage = async (event) => {
        const msg: SignalMsg = JSON.parse(event.data);

        switch (msg.type) {
          case "room-full":
            setStatus("room-full");
            break;

          case "peer-joined": {
            remotePeerIdRef.current = msg.peer_id;
            setStatus("connecting");

            // If peer connection was closed (reconnect scenario), create a new one
            if (!pcRef.current || pcRef.current.connectionState === "closed") {
              const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
              pcRef.current = pc;
              if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current!));
              }
              pc.ontrack = (event) => setRemoteStream(event.streams[0]);
              pc.onicecandidate = (event) => {
                if (event.candidate && remotePeerIdRef.current) {
                  send({ type: "ice-candidate", candidate: event.candidate.toJSON(), to: remotePeerIdRef.current, from: peerId });
                }
              };
              pc.onconnectionstatechange = () => {
                if (pc.connectionState === "connected") setStatus("connected");
                if (pc.connectionState === "failed") setStatus("error");
              };
              // Recreate data channel for sync
              const dc = pc.createDataChannel("sync");
              dcRef.current = dc;
              dc.onmessage = (e) => { try { handlePayload(JSON.parse(e.data)); } catch {} };
              pc.ondatachannel = (event) => {
                dcRef.current = event.channel;
                event.channel.onmessage = (e) => { try { handlePayload(JSON.parse(e.data)); } catch {} };
              };
            }

            if (isInitiator) {
              const offer = await pcRef.current!.createOffer();
              await pcRef.current!.setLocalDescription(offer);
              send({ type: "offer", sdp: offer.sdp!, to: msg.peer_id, from: peerId });
            }
            break;
          }

          case "offer": {
            remotePeerIdRef.current = msg.from ?? remotePeerIdRef.current;
            setStatus("connecting");

            // Create new peer connection if needed (reconnect scenario)
            if (!pcRef.current || pcRef.current.connectionState === "closed") {
              const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
              pcRef.current = pc;
              if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current!));
              }
              pc.ontrack = (event) => setRemoteStream(event.streams[0]);
              pc.onicecandidate = (event) => {
                if (event.candidate && remotePeerIdRef.current) {
                  send({ type: "ice-candidate", candidate: event.candidate.toJSON(), to: remotePeerIdRef.current, from: peerId });
                }
              };
              pc.onconnectionstatechange = () => {
                if (pc.connectionState === "connected") setStatus("connected");
                if (pc.connectionState === "failed") setStatus("error");
              };
              pc.ondatachannel = (event) => {
                dcRef.current = event.channel;
                event.channel.onmessage = (e) => { try { handlePayload(JSON.parse(e.data)); } catch {} };
              };
            }

            await pcRef.current!.setRemoteDescription({ type: "offer", sdp: msg.sdp });
            
            for (const c of iceQueue) {
              await pcRef.current!.addIceCandidate(c).catch(e => console.error(e));
            }
            iceQueue.length = 0;

            const answer = await pcRef.current!.createAnswer();
            await pcRef.current!.setLocalDescription(answer);
            if (remotePeerIdRef.current) {
              send({ type: "answer", sdp: answer.sdp!, to: remotePeerIdRef.current, from: peerId });
            }
            break;
          }

          case "answer":
            remotePeerIdRef.current = msg.from ?? remotePeerIdRef.current;
            await pcRef.current?.setRemoteDescription({ type: "answer", sdp: msg.sdp });

            for (const c of iceQueue) {
              await pcRef.current?.addIceCandidate(c).catch(e => console.error(e));
            }
            iceQueue.length = 0;
            break;

          case "ice-candidate":
            remotePeerIdRef.current = msg.from ?? remotePeerIdRef.current;
            if (pcRef.current?.remoteDescription) {
              try {
                await pcRef.current.addIceCandidate(msg.candidate);
              } catch (err) {
                console.error("ICE candidate error", err);
              }
            } else {
              iceQueue.push(msg.candidate);
            }
            break;

          case "sync":
            handlePayload(msg.payload);
            break;

          case "peer-left":
            setStatus("peer-left");
            setRemoteStream(null);
            remotePeerIdRef.current = null;
            // Don't close WebSocket — keep listening for a new peer to join
            // Reset the peer connection so we can establish a new one
            if (pcRef.current) {
              pcRef.current.close();
              pcRef.current = null;
            }
            dcRef.current = null;
            break;
        }
      };

      // Remember who the remote peer is as soon as we see any message referencing them.
      ws.addEventListener("message", (event) => {
        const msg: SignalMsg = JSON.parse(event.data);
        if (msg.type === "peer-joined") remotePeerIdRef.current = msg.peer_id;
      });
    }

    setup().catch((err) => {
      console.error(err);
      setStatus("error");
    });

    return () => {
      cancelled = true;
      wsRef.current?.close();
      pcRef.current?.close();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signalUrl, roomId, peerId]);

  return { status, localStream, remoteStream, sendSync };
}
