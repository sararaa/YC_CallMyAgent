"""Gemini function declarations + dispatch map for every Volt tool.

States restrict which tools Gemini sees. `tools_for_state(state)` builds the
exact list passed into the Gemini call so the model physically cannot call a
tool outside the current state's whitelist.
"""
from __future__ import annotations

from typing import Any, Awaitable, Callable

from backend.session import CallSession
from backend.state_machine import STATES
from backend.tools import actions, memory, telemetry, transitions

# --- Reusable fragments ---
REASON = {
    "type": "string",
    "description": (
        "One-sentence justification for this decision in plain language. "
        "Reference specific evidence (telemetry codes, caller statements, KB matches)."
    ),
}
CONFIDENCE = {
    "type": "number",
    "description": (
        "Your self-assessed confidence in this decision, from 0.0 (pure guess) to 1.0 (certain). "
        "Be honest — if telemetry is ambiguous or the caller's description is vague, score lower. "
        "If multiple error codes converge on one diagnosis, score higher."
    ),
}

# --- Function declarations (Gemini-shaped) ---
DECLARATIONS: dict[str, dict] = {
    "recall_session": {
        "name": "recall_session",
        "description": "Recall something said earlier in THIS call. Use for 'what did I just say', 'a minute ago'.",
        "parameters": {
            "type": "object",
            "properties": {"query": {"type": "string"}},
            "required": ["query"],
        },
    },
    "recall_knowledge": {
        "name": "recall_knowledge",
        "description": "Search the knowledge base (charger telemetry summaries + KB guides) for factual support content.",
        "parameters": {
            "type": "object",
            "properties": {"query": {"type": "string"}},
            "required": ["query"],
        },
    },
    "get_charger_telemetry": {
        "name": "get_charger_telemetry",
        "description": "Fetch the full telemetry summary for a specific charger (e.g. 'charger2').",
        "parameters": {
            "type": "object",
            "properties": {"charger_id": {"type": "string"}},
            "required": ["charger_id"],
        },
    },
    "send_remote_command": {
        "name": "send_remote_command",
        "description": "Queue a remote command against a charger.",
        "parameters": {
            "type": "object",
            "properties": {
                "charger_id": {"type": "string"},
                "command": {
                    "type": "string",
                    "enum": ["reboot", "reset_session", "clear_fault", "ota_update"],
                },
                "reason": REASON,
                "confidence": CONFIDENCE,
            },
            "required": ["charger_id", "command"],
        },
    },
    "create_work_order": {
        "name": "create_work_order",
        "description": "Open a technician work order for a hardware fault.",
        "parameters": {
            "type": "object",
            "properties": {
                "charger_id": {"type": "string"},
                "severity": {"type": "string", "enum": ["low", "medium", "high", "critical"]},
                "symptoms": {"type": "string"},
                "telemetry_snippet": {"type": "string"},
                "reason": REASON,
                "confidence": CONFIDENCE,
            },
            "required": ["charger_id", "severity", "symptoms"],
        },
    },
    "generate_report": {
        "name": "generate_report",
        "description": "Generate the call's final wrap-up report. Include a fault analysis if a specific fault was identified (e.g. CONTACTOR_WELDED, PILOT_SIGNAL_LOST). Parts list is optional but improves the report.",
        "parameters": {
            "type": "object",
            "properties": {
                "resolution_type": {"type": "string", "enum": ["user", "software", "hardware", "unresolved"]},
                "summary": {"type": "string"},
                "actions_taken": {"type": "array", "items": {"type": "string"}},
                "follow_up_needed": {"type": "string"},
                "confidence": CONFIDENCE,
                "fault_code": {
                    "type": "string",
                    "description": "Standard EVSE/OCPP fault code identified, e.g. 'EVSE-E023', 'CONTACTOR-WELDED'. Empty if no specific fault.",
                },
                "fault_description": {
                    "type": "string",
                    "description": "One-sentence description of the fault (or '').",
                },
                "urgency": {
                    "type": "string",
                    "enum": ["P1", "P2", "P3", "P4"],
                    "description": "P1=critical/24h, P2=high/72h, P3=normal, P4=low.",
                },
                "parts": {
                    "type": "array",
                    "description": "Suspected replacement parts, if known.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "part_number": {"type": "string"},
                            "stock": {"type": "string", "enum": ["in_stock", "low_stock", "order_required"]},
                        },
                        "required": ["name"],
                    },
                },
            },
            "required": ["resolution_type", "summary", "actions_taken"],
        },
    },
    "dispatch_technician": {
        "name": "dispatch_technician",
        "description": "Email a field technician to dispatch them for a hardware work order. Call only after create_work_order has returned a work_order_id.",
        "parameters": {
            "type": "object",
            "properties": {
                "work_order_id": {"type": "integer", "description": "The work_order_id returned by create_work_order."},
                "technician_email": {"type": "string", "description": "Optional override email; defaults to the on-call technician from config."},
                "reason": REASON,
                "confidence": CONFIDENCE,
            },
            "required": ["work_order_id"],
        },
    },
    "advance_to_scoping": {
        "name": "advance_to_scoping",
        "description": "Transition to the scoping stage.",
        "parameters": {"type": "object", "properties": {"reason": {"type": "string"}}, "required": []},
    },
    "advance_to_triage": {
        "name": "advance_to_triage",
        "description": "Transition to the triage stage.",
        "parameters": {"type": "object", "properties": {"reason": {"type": "string"}}, "required": []},
    },
    "route_to_user_issue": {
        "name": "route_to_user_issue",
        "description": "Route to user-issue resolution (account/app/payment/confusion).",
        "parameters": {
            "type": "object",
            "properties": {"reason": REASON, "confidence": CONFIDENCE},
            "required": [],
        },
    },
    "route_to_software_issue": {
        "name": "route_to_software_issue",
        "description": "Route to software-issue resolution (charger online but misbehaving).",
        "parameters": {
            "type": "object",
            "properties": {"reason": REASON, "confidence": CONFIDENCE},
            "required": [],
        },
    },
    "route_to_hardware_issue": {
        "name": "route_to_hardware_issue",
        "description": "Route to hardware-issue resolution (physical damage, won't power on, etc).",
        "parameters": {
            "type": "object",
            "properties": {"reason": REASON, "confidence": CONFIDENCE},
            "required": [],
        },
    },
    "advance_to_wrap_up": {
        "name": "advance_to_wrap_up",
        "description": "Transition to the wrap-up stage.",
        "parameters": {"type": "object", "properties": {"reason": {"type": "string"}}, "required": []},
    },
    "end_call": {
        "name": "end_call",
        "description": "End the call. Persist transcript + summary to long-term memory.",
        "parameters": {"type": "object", "properties": {}, "required": []},
    },
}


Dispatcher = Callable[..., Awaitable[dict]]

DISPATCH: dict[str, Dispatcher] = {
    "recall_session": memory.recall_session,
    "recall_knowledge": memory.recall_knowledge,
    "get_charger_telemetry": telemetry.get_charger_telemetry,
    "send_remote_command": actions.send_remote_command,
    "create_work_order": actions.create_work_order,
    "dispatch_technician": actions.dispatch_technician,
    "generate_report": actions.generate_report,
    "advance_to_scoping": transitions.advance_to_scoping,
    "advance_to_triage": transitions.advance_to_triage,
    "route_to_user_issue": transitions.route_to_user_issue,
    "route_to_software_issue": transitions.route_to_software_issue,
    "route_to_hardware_issue": transitions.route_to_hardware_issue,
    "advance_to_wrap_up": transitions.advance_to_wrap_up,
    "end_call": actions.end_call,
}


def tools_for_state(state: str) -> list[dict]:
    names = STATES[state]["tools"]
    return [{"function_declarations": [DECLARATIONS[n] for n in names]}]


async def dispatch(s: CallSession, name: str, args: dict[str, Any]) -> dict:
    fn = DISPATCH.get(name)
    if not fn:
        return {"error": f"unknown tool {name}"}
    return await fn(s, **(args or {}))
