// Operator-view (Volt) types — backed by Python backend WebSocket events.
// Keep separate from the ChargePulse domain types in ./types.ts.

export type StateName =
  | "greeting"
  | "scoping"
  | "triage"
  | "resolve_user"
  | "resolve_software"
  | "resolve_hardware"
  | "wrap_up"
  | "ended";

export type LatencyComponent =
  | "gemini"
  | "moss_session"
  | "moss_kb"
  | "supermemory";

export type MemoryTier = "session" | "knowledge" | "long_term";

export type ToolName =
  | "recall_session"
  | "recall_knowledge"
  | "get_charger_telemetry"
  | "send_remote_command"
  | "create_work_order"
  | "generate_report"
  | "advance_to_scoping"
  | "advance_to_triage"
  | "route_to_user_issue"
  | "route_to_software_issue"
  | "route_to_hardware_issue"
  | "advance_to_wrap_up"
  | "end_call";

export type ToolFireState = "idle" | "firing" | "ok" | "error";

export type MemoryCard = {
  id: string;
  tier: MemoryTier;
  text: string;
  source: string | null;
  score?: number;
  latencyMs: number;
  hit: boolean;
  ts: number;
};

export type LastDecision = {
  tool: ToolName;
  confidence: number | null;
  reason: string | null;
  durationMs: number;
  at: number;
};

export const STATE_LAYOUT: Record<Exclude<StateName, "ended">, { x: number; y: number; label: string }> = {
  greeting:         { x: 0.10, y: 0.50, label: "Greeting" },
  scoping:          { x: 0.28, y: 0.50, label: "Scoping" },
  triage:           { x: 0.46, y: 0.50, label: "Triage" },
  resolve_user:     { x: 0.66, y: 0.20, label: "User Issue" },
  resolve_software: { x: 0.66, y: 0.50, label: "Software" },
  resolve_hardware: { x: 0.66, y: 0.80, label: "Hardware" },
  wrap_up:          { x: 0.88, y: 0.50, label: "Wrap Up" },
};

export const STATE_EDGES: Array<[Exclude<StateName, "ended">, Exclude<StateName, "ended">]> = [
  ["greeting", "scoping"],
  ["scoping", "triage"],
  ["triage", "resolve_user"],
  ["triage", "resolve_software"],
  ["triage", "resolve_hardware"],
  ["resolve_user", "wrap_up"],
  ["resolve_software", "wrap_up"],
  ["resolve_hardware", "wrap_up"],
];

export const STATE_SUFFIX: Record<Exclude<StateName, "ended">, string> = {
  greeting: "Greet the caller. Ask how you can help.",
  scoping: "Understand the problem in plain language.",
  triage: "Decide: USER · SOFTWARE · HARDWARE.",
  resolve_user: "Walk the caller through user-issue steps.",
  resolve_software: "Pull telemetry. Issue a remote command if appropriate.",
  resolve_hardware: "Pull telemetry. Open a work order.",
  wrap_up: "Summarize. Generate report. End call.",
};

export const ALL_TOOLS: ToolName[] = [
  "recall_session", "recall_knowledge", "get_charger_telemetry",
  "send_remote_command", "create_work_order", "generate_report",
  "advance_to_scoping", "advance_to_triage",
  "route_to_user_issue", "route_to_software_issue", "route_to_hardware_issue",
  "advance_to_wrap_up", "end_call",
];

export const STATE_TOOLS: Record<Exclude<StateName, "ended">, ToolName[]> = {
  greeting: ["advance_to_scoping"],
  scoping: ["recall_session", "advance_to_triage"],
  triage: ["recall_session", "route_to_user_issue", "route_to_software_issue", "route_to_hardware_issue"],
  resolve_user: ["recall_session", "recall_knowledge", "advance_to_wrap_up"],
  resolve_software: ["recall_session", "recall_knowledge", "get_charger_telemetry", "send_remote_command", "advance_to_wrap_up"],
  resolve_hardware: ["recall_session", "recall_knowledge", "get_charger_telemetry", "create_work_order", "advance_to_wrap_up"],
  wrap_up: ["generate_report", "end_call"],
};

export const TOOL_CATEGORY: Record<ToolName, "memory" | "telemetry" | "action" | "transition"> = {
  recall_session: "memory",
  recall_knowledge: "memory",
  get_charger_telemetry: "telemetry",
  send_remote_command: "action",
  create_work_order: "action",
  generate_report: "action",
  advance_to_scoping: "transition",
  advance_to_triage: "transition",
  route_to_user_issue: "transition",
  route_to_software_issue: "transition",
  route_to_hardware_issue: "transition",
  advance_to_wrap_up: "transition",
  end_call: "transition",
};

// WebSocket event types (must match backend/observer.py emissions)
export type AnyVoltEvent =
  | { type: "hello"; session_id: null; timestamp: null; payload: { ok: true } }
  | { type: "call_start"; session_id: string; timestamp: string; payload: { caller_phone: string; session_id: string } }
  | { type: "call_end"; session_id: string; timestamp: string; payload: { duration_s: number; final_state: StateName; overall_confidence: number | null } }
  | { type: "state_transition"; session_id: string; timestamp: string; payload: { from: StateName; to: StateName; reason: string | null; confidence: number | null } }
  | { type: "tool_call_start"; session_id: string; timestamp: string; payload: { request_id: string; tool: ToolName; args: Record<string, unknown> } }
  | { type: "tool_call_end"; session_id: string; timestamp: string; payload: { request_id: string; tool: ToolName; result_preview: string; duration_ms: number; ok: boolean; confidence: number | null; reason: string | null } }
  | { type: "memory_query"; session_id: string; timestamp: string; payload: { tier: MemoryTier; query: string; results: { text: string; source: string | null; score: number }[]; duration_ms: number; hit: boolean } }
  | { type: "memory_ingest"; session_id: string; timestamp: string; payload: { tier: MemoryTier; doc_id: string; text_preview: string; latency_ms: number; preload?: boolean; count?: number } }
  | { type: "transcript"; session_id: string; timestamp: string; payload: { role: "caller" | "agent"; text: string; error?: string } }
  | { type: "latency_sample"; session_id: string; timestamp: string; payload: { component: LatencyComponent; ms: number } }
  | { type: "admin_update"; session_id: string; timestamp: string; payload: { kind: "work_order" | "remote_command" | "report"; id: number; fields: Record<string, unknown> } }
  | { type: "tool_artifact"; session_id: string; timestamp: string; payload: Record<string, unknown> & { kind: string } }
  | { type: "work_order_created"; session_id: string; timestamp: string; payload: Record<string, unknown> }
  | { type: "gemini_analysis"; session_id: string; timestamp: string; payload: import("./types").GeminiResult }
  | { type: "state_focus"; session_id: string; timestamp: string; payload: { state: StateName; text: string } }
  | { type: "reset"; session_id: null; timestamp: string; payload: Record<string, never> };
