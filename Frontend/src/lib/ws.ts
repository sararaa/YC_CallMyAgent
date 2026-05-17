import type { AnyVoltEvent } from "./voltTypes";

export type WsStatus = "connecting" | "open" | "closed";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/dashboard";

export function createWsClient(
  onEvent: (e: AnyVoltEvent) => void,
  onStatus: (s: WsStatus) => void,
) {
  let socket: WebSocket | null = null;
  let stopped = false;
  let backoffMs = 500;

  const connect = () => {
    if (stopped) return;
    onStatus("connecting");
    try {
      socket = new WebSocket(WS_URL);
    } catch (e) {
      console.error("ws ctor failed", e);
      setTimeout(connect, backoffMs);
      backoffMs = Math.min(backoffMs * 1.8, 8000);
      return;
    }
    socket.onopen = () => {
      backoffMs = 500;
      onStatus("open");
    };
    socket.onmessage = (msg) => {
      try {
        onEvent(JSON.parse(msg.data) as AnyVoltEvent);
      } catch {
        /* ignore malformed */
      }
    };
    socket.onclose = () => {
      onStatus("closed");
      if (!stopped) {
        setTimeout(connect, backoffMs);
        backoffMs = Math.min(backoffMs * 1.8, 8000);
      }
    };
    socket.onerror = () => {
      try { socket?.close(); } catch { /* noop */ }
    };
  };

  connect();
  return { close: () => { stopped = true; try { socket?.close(); } catch { /* noop */ } } };
}
