"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type RelayStatus =
  | "disconnected"
  | "connecting"
  | "waiting-for-partner"
  | "connected"
  | "partner-left"
  | "error";

export type PlanChoiceType = "A" | "B" | "CUSTOM" | "SKIP";

export type PlanSyncMessage =
  | { type: "player-info"; name: string; role: "host" | "guest" }
  | { type: "start-game"; hostName: string; guestName: string }
  | { type: "lock-answer"; questionIndex: number; fromRole: "host" | "guest" }
  | {
      type: "reveal-answer";
      questionIndex: number;
      fromRole: "host" | "guest";
      choice: PlanChoiceType;
      customText?: string;
    }
  | { type: "next-question"; questionIndex: number }
  | { type: "restart-game" };

interface UseRencanaKitaRelayOpts {
  signalUrl: string;
  roomId: string;
  peerId: string;
  isHost: boolean;
  onMessage?: (msg: PlanSyncMessage) => void;
  onPartnerJoined?: (partnerPeerId: string) => void;
  onPartnerLeft?: () => void;
}

export function useRencanaKitaRelay({
  signalUrl,
  roomId,
  peerId,
  isHost,
  onMessage,
  onPartnerJoined,
  onPartnerLeft,
}: UseRencanaKitaRelayOpts) {
  const [status, setStatus] = useState<RelayStatus>("disconnected");
  const [partnerConnected, setPartnerConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const remotePeerIdRef = useRef<string | null>(null);
  const pendingQueueRef = useRef<PlanSyncMessage[]>([]);

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
      return true;
    }
    return false;
  }, []);

  const sendMessage = useCallback(
    (msg: PlanSyncMessage) => {
      if (remotePeerIdRef.current) {
        console.log("[RencanaKita Relay] Sending message to", remotePeerIdRef.current, msg);
        sendWs({
          type: "sync",
          payload: msg,
          to: remotePeerIdRef.current,
          from: peerId,
        });
      } else {
        console.log("[RencanaKita Relay] Partner not connected yet, queueing:", msg);
        pendingQueueRef.current.push(msg);
      }
    },
    [peerId, sendWs]
  );

  useEffect(() => {
    if (!roomId || !peerId || !signalUrl) return;

    let isMounted = true;
    setStatus("connecting");

    const cleanSignalUrl = signalUrl
      .trim()
      .replace(/\/+$/, "")
      .replace(/^http:/, "ws:")
      .replace(/^https:/, "wss:");

    const wsUrl = `${cleanSignalUrl}/ws/${roomId}/${peerId}`;
    console.log("[RencanaKita Relay] Connecting to", wsUrl);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!isMounted) return;
      console.log("[RencanaKita Relay] Connected to signaling relay");
      setStatus(isHost ? "waiting-for-partner" : "connecting");
    };

    ws.onmessage = (event) => {
      if (!isMounted) return;
      try {
        const data = JSON.parse(event.data);
        console.log("[RencanaKita Relay] WS received:", data);

        switch (data.type) {
          case "peer-joined": {
            remotePeerIdRef.current = data.peer_id;
            setPartnerConnected(true);
            setStatus("connected");
            onPartnerJoinedRef.current?.(data.peer_id);

            // Flush any pending messages that were queued
            if (pendingQueueRef.current.length > 0) {
              const queue = [...pendingQueueRef.current];
              pendingQueueRef.current = [];
              for (const queuedMsg of queue) {
                console.log("[RencanaKita Relay] Flushing queued message to", data.peer_id, queuedMsg);
                sendWs({
                  type: "sync",
                  payload: queuedMsg,
                  to: data.peer_id,
                  from: peerId,
                });
              }
            }
            break;
          }

          case "sync": {
            if (data.payload) {
              console.log("[RencanaKita Relay] Dispatching sync payload:", data.payload);
              if (!remotePeerIdRef.current && data.from) {
                remotePeerIdRef.current = data.from;
                setPartnerConnected(true);
                setStatus("connected");
              }
              onMessageRef.current?.(data.payload as PlanSyncMessage);
            }
            break;
          }

          case "peer-left": {
            console.log("[RencanaKita Relay] Partner left room");
            setPartnerConnected(false);
            setStatus("partner-left");
            remotePeerIdRef.current = null;
            onPartnerLeftRef.current?.();
            break;
          }
        }
      } catch (err) {
        console.error("[RencanaKita Relay] Error handling message:", err);
      }
    };

    ws.onerror = (e) => {
      if (!isMounted) return;
      console.error("[RencanaKita Relay] WS error:", e);
      setStatus("error");
    };

    ws.onclose = () => {
      if (!isMounted) return;
      console.log("[RencanaKita Relay] WS closed");
      setStatus("disconnected");
      setPartnerConnected(false);
    };

    return () => {
      isMounted = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      remotePeerIdRef.current = null;
    };
  }, [signalUrl, roomId, peerId, isHost, sendWs]);

  return {
    status,
    partnerConnected,
    sendMessage,
  };
}
