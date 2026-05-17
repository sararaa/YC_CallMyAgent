"""Build the `volt-kb` Moss index from Data_RAG/.

Run manually:  backend/.venv/bin/python -m backend.scripts.upload
Or call build_volt_kb() from app startup for stub-mode auto-load.

Sources ingested:
  - Data_RAG/chargerX_summary.md (per-charger telemetry summaries)
  - Data_RAG/TRIAGE.md
  - Data_RAG/KB-*.pdf (extracted with pypdf)
"""
from __future__ import annotations

import asyncio
import logging
import re
from pathlib import Path

from backend import config
from backend.memory import moss_client

log = logging.getLogger("volt.upload")

CHUNK_TOKENS = 500
TOKEN_RE = re.compile(r"\S+")


def _chunk(text: str, target_tokens: int = CHUNK_TOKENS) -> list[str]:
    """Header-aware-ish chunking: split on blank lines, then pack into ~target_tokens chunks."""
    paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks: list[str] = []
    buf: list[str] = []
    buf_tokens = 0
    for p in paras:
        ntok = len(TOKEN_RE.findall(p))
        if buf and buf_tokens + ntok > target_tokens:
            chunks.append("\n\n".join(buf))
            buf, buf_tokens = [], 0
        buf.append(p)
        buf_tokens += ntok
    if buf:
        chunks.append("\n\n".join(buf))
    return chunks


def _read_pdf(path: Path) -> str:
    from pypdf import PdfReader  # local import: optional dep at import time
    reader = PdfReader(str(path))
    out = []
    for page in reader.pages:
        try:
            out.append(page.extract_text() or "")
        except Exception:  # noqa: BLE001
            continue
    return "\n\n".join(out)


def _gather_docs() -> list[dict]:
    docs: list[dict] = []
    if not config.DATA_RAG_DIR.exists():
        log.warning("Data_RAG dir missing: %s", config.DATA_RAG_DIR)
        return docs

    for md in sorted(config.DATA_RAG_DIR.glob("*.md")):
        text = md.read_text()
        for i, chunk in enumerate(_chunk(text)):
            docs.append({
                "id": f"{md.stem}-{i}",
                "text": chunk,
                "metadata": {"source": md.name, "kind": "markdown"},
            })

    for pdf in sorted(config.DATA_RAG_DIR.glob("*.pdf")):
        try:
            text = _read_pdf(pdf)
        except Exception as e:  # noqa: BLE001
            log.warning("PDF extract failed for %s: %s", pdf.name, e)
            continue
        if not text.strip():
            continue
        for i, chunk in enumerate(_chunk(text)):
            docs.append({
                "id": f"{pdf.stem.replace(' ', '_')}-{i}",
                "text": chunk,
                "metadata": {"source": pdf.name, "kind": "pdf"},
            })

    return docs


async def build_volt_kb() -> int:
    docs = _gather_docs()
    if not docs:
        log.warning("No KB docs found — volt-kb will be empty.")
        return 0
    # Delete + recreate so reruns are clean
    try:
        await moss_client.delete_index(config.VOLT_KB_INDEX)
    except Exception:  # noqa: BLE001
        pass
    await moss_client.create_index(config.VOLT_KB_INDEX, docs)
    log.info("Indexed %d chunks into %s", len(docs), config.VOLT_KB_INDEX)
    return len(docs)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    n = asyncio.run(build_volt_kb())
    sources: set[str] = set()
    for d in _gather_docs():
        sources.add(d["metadata"]["source"])
    print(f"Indexed {n} chunks into {config.VOLT_KB_INDEX} from {len(sources)} files.")
    print("Sources:")
    for s in sorted(sources):
        print(f"  - {s}")


if __name__ == "__main__":
    main()
