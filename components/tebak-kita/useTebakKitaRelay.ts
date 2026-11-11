"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getApiUrl } from "@/lib/api-config";

export type RelayStatus =
  | "disconnected"
  | "connecting"
  | "waiting-for-partner"
  | "connected"
  | "partner-left"
  | "error";

export type GameSyncMessage =
  | { type: "player-info"; name: string; role: "host" | "guest" }
  | { type: "start-game"; hostName: string; guestName: string }
  | { type: "lock-answer"; questionIndex: number; fromRole: "host" | "guest" }
  | {
      type: "reveal-answer";
      questionIndex: number;
      fromRole: "host" | "guest";
      choice: "player1" | "player2";
    }
  | { type: "restart-game" };

interface UseTebakKitaRelayOpts {
  signalUrl: string;
  roomId: string;
  peerId: string;
  isHost: boolean;
  onMessage?: (msg: GameSyncMessage) => void;
  onPartnerJoined?: (partnerPeerId: string) => void;
  onPartnerLeft?: () => void;
}

export function useTebakKitaRelay({
  signalUrl,
  roomId,
  peerId,
  isHost,
  onMessage,
  onPartnerJoined,
  onPartnerLeft,
}: UseTebakKitaRelayOpts) {
  const [status, setStatus] = useState<RelayStatus>("disconnected");
  const [partnerConnected, setPartnerConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const remotePeerIdRef = useRef<string | null>(null);

  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const onPartnerJoinedRef = useRef(onPartnerJoined);
  useEffect(() => {
    onPartnerJoinedRef.current = onPartnerJoined;
  }, [onPartnerJoined]);

  const onPartnerLeftRef = useRef(onPartnerLeft);
  useEffect(() => {
    onPartnerLeftRef.current = onPartnerLeft;
  }, [onPartnerLeft]);

  const sendWs = useCallback((data: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const sendMessage = useCallback(
    (msg: GameSyncMessage) => {
      // 1. Try sending over WebRTC DataChannel for zero latency
      if (dcRef.current && dcRef.current.readyState === "open") {
        try {
          dcRef.current.send(JSON.stringify(msg));
          return;
        } catch {
          // fallback to ws
        }
      }

      // 2. Fallback: send through WebSocket relay
      if (remotePeerIdRef.current) {
        sendWs({
          type: "sync",
          payload: msg,
          to: remotePeerIdRef.current,
          from: peerId,
        });
      }
    },
    [peerId, sendWs]
  );

  useEffect(() => {
    if (!roomId || !peerId || !signalUrl) return;

    let isMounted = true;
    setStatus("connecting");

    // Fetch TURN credentials
    let iceServers: RTCIceServer[] = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:global.stun.twilio.com:3478" },
    ];

    async function initRelay() {
      try {
        const apiUrl = getApiUrl("/api/turn-credentials");
        const res = await fetch(apiUrl, { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          if (data.iceServers?.length) iceServers = data.iceServers;
        }
      } catch {
        // use default STUN
      }

      if (!isMounted) return;

      const cleanSignalUrl = signalUrl
        .trim()
        .replace(/\/+$/, "")
        .replace(/^http:/, "ws:")
        .replace(/^https:/, "wss:");
      const ws = new WebSocket(`${cleanSignalUrl}/ws/${roomId}/${peerId}`);
      wsRef.current = ws;

      const iceQueue: RTCIceCandidateInit[] = [];

      ws.onopen = () => {
        if (!isMounted) return;
        setStatus(isHost ? "waiting-for-partner" : "connecting");
      };

      ws.onmessage = async (event) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case "peer-joined": {
              remotePeerIdRef.current = data.peer_id;
              setPartnerConnected(true);
              setStatus("connected");
              onPartnerJoinedRef.current?.(data.peer_id);

              // WebRTC setup (data channel only, no camera/mic required!)
              const pc = new RTCPeerConnection({ iceServers });
              pcRef.current = pc;

              pc.onicecandidate = (e) => {
                if (e.candidate && remotePeerIdRef.current) {
                  sendWs({
                    type: "ice-candidate",
                    candidate: e.candidate.toJSON(),
                    to: remotePeerIdRef.current,
                    from: peerId,
                  });
                }
              };

              const dc = pc.createDataChannel("game-sync");
              dcRef.current = dc;
              dc.onmessage = (e) => {
                try {
                  onMessageRef.current?.(JSON.parse(e.data));
                } catch {}
              };

              if (isHost) {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                sendWs({
                  type: "offer",
                  sdp: offer.sdp,
                  to: data.peer_id,
                  from: peerId,
                });
              }
              break;
            }

            case "offer": {
              remotePeerIdRef.current = data.from ?? remotePeerIdRef.current;
              setPartnerConnected(true);
              setStatus("connected");
              onPartnerJoinedRef.current?.(data.from);

              const pc = new RTCPeerConnection({ iceServers });
              pcRef.current = pc;

              pc.onicecandidate = (e) => {
                if (e.candidate && remotePeerIdRef.current) {
                  sendWs({
                    type: "ice-candidate",
                    candidate: e.candidate.toJSON(),
                    to: remotePeerIdRef.current,
                    from: peerId,
                  });
                }
              };

              pc.ondatachannel = (e) => {
                dcRef.current = e.channel;
                e.channel.onmessage = (msgEvent) => {
                  try {
                    onMessageRef.current?.(JSON.parse(msgEvent.data));
                  } catch {}
                };
              };

              await pc.setRemoteDescription({ type: "offer", sdp: data.sdp });
              for (const c of iceQueue) {
                await pc.addIceCandidate(c).catch(() => {});
              }
              iceQueue.length = 0;

              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              if (remotePeerIdRef.current) {
                sendWs({
                  type: "answer",
                  sdp: answer.sdp,
                  to: remotePeerIdRef.current,
                  from: peerId,
                });
              }
              break;
            }

            case "answer": {
              remotePeerIdRef.current = data.from ?? remotePeerIdRef.current;
              await pcRef.current?.setRemoteDescription({
                type: "answer",
                sdp: data.sdp,
              });
              for (const c of iceQueue) {
                await pcRef.current?.addIceCandidate(c).catch(() => {});
              }
              iceQueue.length = 0;
              break;
            }

            case "ice-candidate": {
              remotePeerIdRef.current = data.from ?? remotePeerIdRef.current;
              if (pcRef.current?.remoteDescription) {
                pcRef.current.addIceCandidate(data.candidate).catch(() => {});
              } else {
                iceQueue.push(data.candidate);
              }
              break;
            }

            case "sync": {
              if (data.payload) {
                onMessageRef.current?.(data.payload as GameSyncMessage);
              }
              break;
            }

            case "peer-left": {
              setPartnerConnected(false);
              setStatus("partner-left");
              remotePeerIdRef.current = null;
              if (pcRef.current) {
                pcRef.current.close();
                pcRef.current = null;
              }
              dcRef.current = null;
              onPartnerLeftRef.current?.();
              break;
            }
          }
        } catch {}
      };

      ws.onerror = () => {
        if (!isMounted) return;
        setStatus("error");
      };

      ws.onclose = () => {
        if (!isMounted) return;
        setStatus("disconnected");
        setPartnerConnected(false);
      };
    }

    initRelay();

    return () => {
      isMounted = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      dcRef.current = null;
    };
  }, [signalUrl, roomId, peerId, isHost, sendWs]);

  return {
    status,
    partnerConnected,
    sendMessage,
  };
}

