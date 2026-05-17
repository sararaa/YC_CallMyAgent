import { create } from "zustand";
import type {
  LastDecision,
  LatencyComponent,
  MemoryCard,
  MemoryTier,
  StateName,
  ToolFireState,
  ToolName,
} from "@/lib/voltTypes";
import { ALL_TOOLS } from "@/lib/voltTypes";

type Artifact =
  | { kind: "telemetry"; charger_id: string; markdown: string; id: string }
  | { kind: "telemetry_error"; charger_id: string; available: string[]; id: string }
  | { kind: "work_order"; work_order_id: number; charger_id: string; severity: string; symptoms: string; status: string; id: string }
  | { kind: "remote_command"; command_id: number; charger_id: string; command: string; status: string; id: string }
  | { kind: "report"; report_id: number; resolution_type: string; summary: string; actions_taken: string; follow_up_needed: string; confidence: number | null; overall_confidence: number | null; id: string };

type TranscriptItem =
  | { kind: "turn"; id: string; role: "caller" | "agent"; text: string; ts: string }
  | { kind: "tool"; id: string; tool: ToolName; args?: Record<string, unknown>; result_preview?: string; duration_ms?: number; ok?: boolean; confidence?: number | null; reason?: string | null };

interface OperatorState {
  currentState: StateName;
  visited: Set<StateName>;
  eliminated: Set<StateName>;
  lastTransition: { from: StateName; to: StateName; reason: string | null; confidence: number | null; at: number } | null;
  toolStates: Record<ToolName, ToolFireState>;
  toolsAvailable: ToolName[];
  memory: { session: MemoryCard[]; knowledge: MemoryCard[]; long_term: MemoryCard[] };
  latency: Record<LatencyComponent, number[]>;
  lastDecision: LastDecision | null;
  transcript: TranscriptItem[];
  artifacts: Artifact[];
  preloadAt: number | null;
  writeBackAt: number | null;

  setState: (next: StateName) => void;
  visit: (s: StateName) => void;
  eliminate: (s: StateName) => void;
  setTransition: (from: StateName, to: StateName, reason: string | null, confidence: number | null) => void;
  setToolFire: (tool: ToolName, state: ToolFireState) => void;
  setToolsAvailable: (tools: ToolName[]) => void;
  pushMemory: (tier: MemoryTier, card: MemoryCard) => void;
  pushLatency: (c: LatencyComponent, ms: number) => void;
  setLastDecision: (d: LastDecision) => void;
  pushTranscript: (item: TranscriptItem) => void;
  patchTool: (id: string, patch: Partial<Extract<TranscriptItem, { kind: "tool" }>>) => void;
  pushArtifact: (a: Artifact) => void;
  markPreload: () => void;
  markWriteBack: () => void;
  reset: () => void;
}

const idleTools: Record<ToolName, ToolFireState> = ALL_TOOLS.reduce((acc, t) => {
  acc[t] = "idle";
  return acc;
}, {} as Record<ToolName, ToolFireState>);

const initial: Omit<OperatorState,
  "setState" | "visit" | "eliminate" | "setTransition" | "setToolFire" | "setToolsAvailable" |
  "pushMemory" | "pushLatency" | "setLastDecision" | "pushTranscript" | "patchTool" |
  "pushArtifact" | "markPreload" | "markWriteBack" | "reset"
> = {
  currentState: "greeting",
  visited: new Set<StateName>(["greeting"]),
  eliminated: new Set<StateName>(),
  lastTransition: null,
  toolStates: { ...idleTools },
  toolsAvailable: ["advance_to_scoping"],
  memory: { session: [], knowledge: [], long_term: [] },
  latency: { gemini: [], moss_session: [], moss_kb: [], supermemory: [] },
  lastDecision: null,
  transcript: [],
  artifacts: [],
  preloadAt: null,
  writeBackAt: null,
};

function cap<T>(arr: T[], n: number): T[] {
  return arr.length > n ? arr.slice(0, n) : arr;
}

export const useOperatorStore = create<OperatorState>((set) => ({
  ...initial,

  setState: (next) => set({ currentState: next }),

  visit: (s) => set((st) => {
    const v = new Set(st.visited); v.add(s);
    return { visited: v };
  }),

  eliminate: (s) => set((st) => {
    const e = new Set(st.eliminated); e.add(s);
    return { eliminated: e };
  }),

  setTransition: (from, to, reason, confidence) => set((st) => {
    const visited = new Set(st.visited); visited.add(to);
    const eliminated = new Set(st.eliminated);
    if (from === "triage" && (to === "resolve_user" || to === "resolve_software" || to === "resolve_hardware")) {
      for (const b of ["resolve_user", "resolve_software", "resolve_hardware"] as StateName[]) {
        if (b !== to) eliminated.add(b);
      }
    }
    return {
      currentState: to,
      visited,
      eliminated,
      lastTransition: { from, to, reason, confidence, at: performance.now() },
    };
  }),

  setToolFire: (tool, state) => set((st) => ({ toolStates: { ...st.toolStates, [tool]: state } })),

  setToolsAvailable: (tools) => set({ toolsAvailable: tools }),

  pushMemory: (tier, card) => set((st) => ({
    memory: { ...st.memory, [tier]: cap([card, ...st.memory[tier]], 8) },
  })),

  pushLatency: (c, ms) => set((st) => ({
    latency: { ...st.latency, [c]: [...st.latency[c], ms].slice(-20) },
  })),

  setLastDecision: (d) => set({ lastDecision: d }),

  pushTranscript: (item) => set((st) => ({ transcript: [...st.transcript, item] })),

  patchTool: (id, patch) => set((st) => ({
    transcript: st.transcript.map((t) => (t.kind === "tool" && t.id === id ? { ...t, ...patch } : t)),
  })),

  pushArtifact: (a) => set((st) => ({ artifacts: cap([a, ...st.artifacts], 6) })),

  markPreload: () => set({ preloadAt: performance.now() }),
  markWriteBack: () => set({ writeBackAt: performance.now() }),

  reset: () => set({ ...initial, visited: new Set<StateName>(["greeting"]), eliminated: new Set<StateName>(), toolStates: { ...idleTools } }),
}));
