import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend import config
from backend.db.session import init_db
from backend.routes import admin_api, agentphone, dashboard_ws
from backend.scripts.upload import build_volt_kb

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("volt")


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    if config.using_supermemory_stub():
        log.warning("SUPERMEMORY_API_KEY not set — using in-memory stub.")
    if config.using_moss_stub():
        log.warning("MOSS_PROJECT_ID / MOSS_PROJECT_KEY not set — using in-memory stub.")
    if not config.GEMINI_API_KEY:
        log.warning("GEMINI_API_KEY not set — agent turns will fail until populated.")
    # Prune orphan session indexes from prior runs (Moss free tier caps at 3).
    try:
        from backend.memory.moss_client import prune_orphan_sessions
        await prune_orphan_sessions()
        # ALWAYS rebuild volt-kb on startup so any new Data_RAG files
        # (e.g. howto.md added since the last boot) get indexed. build_volt_kb
        # deletes the existing index first, then recreates from the current
        # Data_RAG directory.
        n = await build_volt_kb()
        log.info("volt-kb rebuilt with %d chunks", n)
    except Exception as e:  # noqa: BLE001
        log.warning("startup moss bootstrap failed: %s", e)
    yield


app = FastAPI(title="Volt", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[config.DASHBOARD_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard_ws.router)
app.include_router(admin_api.router)
app.include_router(agentphone.router)


@app.get("/health")
async def health():
    return {
        "ok": True,
        "stubs": {
            "supermemory": config.using_supermemory_stub(),
            "moss": config.using_moss_stub(),
        },
    }


if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=config.PORT, reload=True)
