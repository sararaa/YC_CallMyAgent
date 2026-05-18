"use client";
/**
 * Single source of truth for the live data feed. Subscribes to the Python
 * backend's /ws/dashboard WebSocket once and fans every event into the
 * relevant zustand stores. Renders nothing.
 *
 * Mount once at the layout level. All pages then read from the stores.
 */
import { useEffect } from "react";
import { create } from "zustand";

import { useCallStore } from "@/store/callStore";
import { useChargerStore } from "@/store/chargerStore";
import { useGeminiStore } from "@/store/geminiStore";
import { useOperatorStore } from "@/store/operatorStore";
import { useWorkOrderStore } from "@/store/workOrderStore";

import type { GeminiResult, WorkOrder } from "./types";
import type {
  AnyVoltEvent,
  StateName,
  ToolName,
} from "./voltTypes";
import { STATE_TOOLS } from "./voltTypes";
import { createWsClient, type WsStatus } from "./ws";

interface WsStatusStore {
  status: WsStatus;
  set: (s: WsStatus) => void;
}
export const useWsStatus = create<WsStatusStore>((set) => ({
  status: "connecting",
  set: (s) => set({ status: s }),
}));

let _wsBootstrapped = false;

export function WsBridge() {
  useEffect(() => {
    if (_wsBootstrapped) return;
    _wsBootstrapped = true;

    const client = createWsClient(
      (evt) => handle(evt),
      (s) => useWsStatus.getState().set(s),
    );
    return () => {
      client.close();
      _wsBootstrapped = false;
    };
  }, []);
  return null;
}

let _toolIdToTool = new Map<string, ToolName>();
let _currentSessionId: string | null = null;

function _resetAllStores() {
  useCallStore.getState().reset();
  useGeminiStore.getState().reset();
  useWorkOrderStore.setState({ currentWO: null, workOrders: [], showModal: false, showToast: false });
  useChargerStore.setState({ activeCharger: null });
  useOperatorStore.getState().reset();
  _toolIdToTool.clear();
}

function handle(evt: AnyVoltEvent): void {
  // Whenever a new session_id appears that's different from what we're
  // tracking, blow away any stale UI state from a prior call BEFORE
  // processing the event. Prevents the "old caller bubble lingers,
  // vanishes, then reappears" flicker.
  const sid = evt.session_id ?? null;
  if (sid && sid !== _currentSessionId) {
    _resetAllStores();
    _currentSessionId = sid;
  }

  switch (evt.type) {
    case "hello":
      return;

    case "reset": {
      _resetAllStores();
      _currentSessionId = null;
      return;
    }

    case "call_start": {
      const p = evt.payload;
      useCallStore.getState().startCall(p.session_id, p.caller_phone, "—");
      useOperatorStore.getState().setCallActive(true);
      return;
    }

    case "call_end": {
      useCallStore.getState().endCall();
      useOperatorStore.setState({ currentState: "ended", writeBackAt: performance.now(), callActive: false });
      return;
    }

    case "state_focus": {
      const p = evt.payload;
      useOperatorStore.getState().setFocus(p.state, p.text);
      return;
    }

    case "state_transition": {
      const p = evt.payload;
      useOperatorStore.getState().setTransition(p.from, p.to, p.reason, p.confidence);
      useOperatorStore.getState().setToolsAvailable(toolsForState(p.to));
      return;
    }

    case "transcript": {
      const p = evt.payload;
      const call = useCallStore.getState();
      const id = `msg-${call.transcript.length + 1}`;
      // ChargePulse only knows 'caller' | 'system'. Map agent → system bubble.
      call.addMessage({
        id,
        role: p.role === "caller" ? "caller" : "system",
        text: p.text,
        timestamp: new Date(),
      });
      useOperatorStore.getState().pushTranscript({
        kind: "turn",
        id,
        role: p.role,
        text: p.text,
        ts: evt.timestamp || new Date().toISOString(),
      });
      return;
    }

    case "tool_call_start": {
      const p = evt.payload;
      _toolIdToTool.set(p.request_id, p.tool);
      useOperatorStore.getState().setToolFire(p.tool, "firing");
      useOperatorStore.getState().pushTranscript({
        kind: "tool",
        id: p.request_id,
        tool: p.tool,
        args: p.args,
      });
      return;
    }

    case "tool_call_end": {
      const p = evt.payload;
      useOperatorStore.getState().setToolFire(p.tool, p.ok ? "ok" : "error");
      useOperatorStore.getState().patchTool(p.request_id, {
        result_preview: p.result_preview,
        duration_ms: p.duration_ms,
        ok: p.ok,
        confidence: p.confidence,
        reason: p.reason,
      });
      if (p.confidence != null) {
        useOperatorStore.getState().setLastDecision({
          tool: p.tool,
          confidence: p.confidence,
          reason: p.reason,
          durationMs: p.duration_ms,
          at: performance.now(),
        });
      }
      _toolIdToTool.delete(p.request_id);
      return;
    }

    case "memory_query": {
      const p = evt.payload;
      const op = useOperatorStore.getState();
      if (p.results.length === 0) {
        op.pushMemory(p.tier, {
          id: `m-${Date.now()}-${Math.random()}`,
          tier: p.tier,
          text: "(no match)",
          source: null,
          latencyMs: p.duration_ms,
          hit: false,
          ts: performance.now(),
        });
      } else {
        for (const r of p.results.slice(0, 3)) {
          op.pushMemory(p.tier, {
            id: `m-${Date.now()}-${Math.random()}`,
            tier: p.tier,
            text: r.text,
            source: r.source,
            score: r.score,
            latencyMs: p.duration_ms,
            hit: true,
            ts: performance.now(),
          });
        }
      }
      return;
    }

    case "memory_ingest": {
      const p = evt.payload;
      const op = useOperatorStore.getState();
      if (p.preload) {
        op.markPreload();
        const n = p.count || 1;
        for (let i = 0; i < Math.min(n, 4); i++) {
          op.pushMemory("session", {
            id: `pre-${Date.now()}-${i}`,
            tier: "session",
            text: p.text_preview || "(preloaded)",
            source: "supermemory.preload",
            latencyMs: p.latency_ms,
            hit: true,
            ts: performance.now(),
          });
        }
      } else {
        op.pushMemory(p.tier, {
          id: `i-${Date.now()}-${Math.random()}`,
          tier: p.tier,
          text: p.text_preview || "(ingested)",
          source: null,
          latencyMs: p.latency_ms,
          hit: true,
          ts: performance.now(),
        });
      }
      return;
    }

    case "latency_sample": {
      const p = evt.payload;
      useOperatorStore.getState().pushLatency(p.component, p.ms);
      return;
    }

    case "tool_artifact": {
      const p = evt.payload as Record<string, unknown> & { kind: string };
      const id = `art-${Date.now()}-${Math.random()}`;
      useOperatorStore.getState().pushArtifact({ ...(p as object), id } as never);

      // Side effect: if telemetry fired, populate chargerStore so the right panel
      // updates immediately (it usually has the data via /api/charger/:id already,
      // but this ensures chargerId on callStore is set).
      if (p.kind === "telemetry" && typeof p.charger_id === "string") {
        useCallStore.setState({ chargerId: p.charger_id });
      }
      return;
    }

    case "work_order_created": {
      const wo = evt.payload as unknown as WorkOrder;
      useWorkOrderStore.getState().setCurrentWO(wo);
      useWorkOrderStore.getState().addWorkOrder(wo);
      useWorkOrderStore.getState().showToastNotification();
      return;
    }

    case "gemini_analysis": {
      const result = evt.payload as GeminiResult;
      const g = useGeminiStore.getState();
      // ChargePulse's flow is: startThinking → appendThinking* → setComplete.
      // Backend doesn't stream thinking, so we synthesize a brief one.
      g.startThinking();
      const thinking = `Synthesized fault analysis: ${result.faultDescription || result.diagnosticSummary}`;
      g.appendThinking(thinking);
      g.setComplete(result);
      return;
    }

    case "dispatch_update": {
      const p = evt.payload;
      useWorkOrderStore.getState().setDispatchStatus(String(p.wo_id), p.status);
      return;
    }

    case "technician_email": {
      const p = evt.payload;
      useWorkOrderStore.getState().appendEmailToThread(String(p.wo_id), {
        direction: p.direction,
        from: p.from,
        subject: p.subject,
        body: p.body_preview,
        timestamp: evt.timestamp,
      });
      return;
    }

    case "admin_update":
    default:
      return;
  }
}

function toolsForState(state: StateName): ToolName[] {
  if (state === "ended") return [];
  return STATE_TOOLS[state];
}
