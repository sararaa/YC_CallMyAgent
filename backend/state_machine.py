BASE_PROMPT = """You are Volt, a voice customer support agent for ChargeForward, an EV charging network.
You're on a phone call. Keep replies short, warm, and natural — one or two sentences at a time.
Never invent telemetry, error codes, or account details. Always use tools to fetch real data.
You operate in discrete stages. Use the transition tools to advance when the current stage's goal is met.
If you don't know which stage you're in, look at the STAGE marker in the system prompt.

When you call a routing or action tool, always include a `reason` (one-sentence
plain-language justification referencing specific evidence) and a `confidence`
score from 0.0 to 1.0. Be honest about confidence — vague caller descriptions
or ambiguous telemetry should score lower (0.4-0.7); converging evidence and
clear fault codes should score higher (0.85-0.98). Never score 1.0 unless the
evidence is unambiguous."""

STATES = {
    "greeting": {
        "suffix": "STAGE: Greeting. Greet the caller warmly. Ask how you can help. As soon as they describe any issue, call advance_to_scoping.",
        "tools": ["advance_to_scoping"],
    },
    "scoping": {
        "suffix": "STAGE: Problem scoping. Understand the problem in plain language. Ask 1-2 focused clarifying questions. Don't diagnose yet. When you can categorize the issue, call advance_to_triage.",
        "tools": ["recall_session", "advance_to_triage"],
    },
    "triage": {
        "suffix": "STAGE: Triage. Decide whether this is a USER issue (account/app/payment/confusion), a SOFTWARE issue (charger online but misbehaving, session errors, communication faults), or a HARDWARE issue (physical damage, won't power on, connector/cable problems). If unclear, ask one targeted question. Then call exactly one route_to_* tool.",
        "tools": ["recall_session", "route_to_user_issue", "route_to_software_issue", "route_to_hardware_issue"],
    },
    "resolve_user": {
        "suffix": "STAGE: User issue resolution. Walk the caller through the relevant steps using recall_knowledge for the right guide. Confirm resolution. Then call advance_to_wrap_up.",
        "tools": ["recall_session", "recall_knowledge", "advance_to_wrap_up"],
    },
    "resolve_software": {
        "suffix": "STAGE: Software issue resolution. Get the charger ID, call get_charger_telemetry. Identify the fault from telemetry. Search the knowledge base for remote resolution steps. Issue a remote command via send_remote_command if appropriate. Then call advance_to_wrap_up.",
        "tools": ["recall_session", "recall_knowledge", "get_charger_telemetry", "send_remote_command", "advance_to_wrap_up"],
    },
    "resolve_hardware": {
        "suffix": "STAGE: Hardware issue resolution. Get the charger ID and visible symptoms. Call get_charger_telemetry to confirm the fault. Then call create_work_order with severity, symptoms, and telemetry snapshot. Then call advance_to_wrap_up.",
        "tools": ["recall_session", "recall_knowledge", "get_charger_telemetry", "create_work_order", "advance_to_wrap_up"],
    },
    "wrap_up": {
        "suffix": "STAGE: Wrap up. Summarize what happened and what was done in one or two sentences. Then call generate_report. Then thank the caller and call end_call.",
        "tools": ["generate_report", "end_call"],
    },
}

TRANSITION_MAP = {
    "advance_to_scoping": "scoping",
    "advance_to_triage": "triage",
    "route_to_user_issue": "resolve_user",
    "route_to_software_issue": "resolve_software",
    "route_to_hardware_issue": "resolve_hardware",
    "advance_to_wrap_up": "wrap_up",
}

# Graph layout for the dashboard. Don't move these or the SVG positions break.
LAYOUT = {
    "greeting":         {"x": 0.10, "y": 0.50, "label": "Greeting"},
    "scoping":          {"x": 0.28, "y": 0.50, "label": "Scoping"},
    "triage":           {"x": 0.46, "y": 0.50, "label": "Triage"},
    "resolve_user":     {"x": 0.66, "y": 0.20, "label": "User Issue"},
    "resolve_software": {"x": 0.66, "y": 0.50, "label": "Software"},
    "resolve_hardware": {"x": 0.66, "y": 0.80, "label": "Hardware"},
    "wrap_up":          {"x": 0.88, "y": 0.50, "label": "Wrap Up"},
}

ALL_TOOLS = [
    "recall_session", "recall_knowledge", "get_charger_telemetry",
    "send_remote_command", "create_work_order", "generate_report",
    "advance_to_scoping", "advance_to_triage",
    "route_to_user_issue", "route_to_software_issue", "route_to_hardware_issue",
    "advance_to_wrap_up", "end_call",
]


def system_prompt(state: str) -> str:
    return f"{BASE_PROMPT}\n\n{STATES[state]['suffix']}"
