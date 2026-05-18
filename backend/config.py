import os
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
load_dotenv(ROOT / ".env.local", override=True)  # Next.js convention: .local wins

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-2.5-flash"

AGENTPHONE_API_KEY = os.getenv("AGENTPHONE_API_KEY", "")
AGENTPHONE_NUMBER = os.getenv("AGENTPHONE_NUMBER", "")
AGENTPHONE_WEBHOOK_SECRET = os.getenv("AGENTPHONE_WEBHOOK_SECRET", "")

SUPERMEMORY_API_KEY = os.getenv("SUPERMEMORY_API_KEY", "")
MOSS_PROJECT_ID = os.getenv("MOSS_PROJECT_ID", "")
MOSS_PROJECT_KEY = os.getenv("MOSS_PROJECT_KEY", "")
MOSS_FORCE_REFRESH_ON_ADD = os.getenv("MOSS_FORCE_REFRESH_ON_ADD", "true").lower() == "true"

PORT = int(os.getenv("PORT", "8000"))
DASHBOARD_ORIGIN = os.getenv("DASHBOARD_ORIGIN", "http://localhost:3000")
DB_PATH = ROOT / os.getenv("DB_PATH", "backend/db/volt.db")
DATA_RAG_DIR = ROOT / "Data_RAG"

VOLT_KB_INDEX = "volt-kb"

AGENTMAIL_API_KEY        = os.getenv("AGENTMAIL_API_KEY", "")
AGENTMAIL_WEBHOOK_SECRET = os.getenv("AGENTMAIL_WEBHOOK_SECRET", "")
TECHNICIAN_EMAIL         = os.getenv("TECHNICIAN_EMAIL", "technician@example.com")


def using_supermemory_stub() -> bool:
    return not SUPERMEMORY_API_KEY


def using_moss_stub() -> bool:
    return not (MOSS_PROJECT_ID and MOSS_PROJECT_KEY)


def using_agentmail_stub() -> bool:
    return not AGENTMAIL_API_KEY
