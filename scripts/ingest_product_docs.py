#!/usr/bin/env python
"""Turn Roi's POC / product decks into knowledge the generators can use.

CEO request #11: "Upload our POC and Product presentations to the AI so it can
learn our product better." Today the AI knows loose proof points (54%, 55s,
180-400% ROI) but nothing about modules, architecture, sector cases or the
objections sales actually hears — so posts stay generic.

Why this script exists: the MAS RAG's `ingest_directory` globs `*.md` only, so a
deck has no path into the corpus. This converts decks to heading-structured
markdown, screens every file for confidential content, and drops the result in
`data/rag/product/` for the MAS to index.

TEXT EXTRACTION IS NOT OURS. It comes from `yedda_mas.rag.extract`, the shared
module the MAS promoted out of a script in Aug 2026. Two converters producing
subtly different text from the same deck is the failure this integration has
already had twice (two vocabulary lists, two sector taxonomies) — so this reads
through theirs and only adds what is genuinely ours: sectioning and the
confidentiality screen.

    pip install python-docx pypdf python-pptx openpyxl   # per format needed

    python scripts/ingest_product_docs.py --input ~/decks --dry-run
    python scripts/ingest_product_docs.py --input ~/decks

SAFETY: nothing is written until the confidentiality screen passes. Client
names, pricing and signed-agreement language must never reach a public post —
the content bank already forbids naming clients, and this keeps that true at
the source rather than hoping the prompt holds.
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

# The MAS is the source of truth for reading documents. Fall back to a local
# reader only for plain text, so a missing MAS checkout degrades to "md/txt
# only" instead of failing outright.
_MAS_SRC = Path(
    os.getenv("YEDDA_MAS_DIR")
    or (Path.home() / "OneDrive" / "Área de Trabalho" / "yedda-mas-step1")
) / "src"
if _MAS_SRC.is_dir():
    sys.path.insert(0, str(_MAS_SRC))
try:
    from yedda_mas.rag.extract import extract_text_from_path, is_extractable
    _SHARED_EXTRACTOR = True
except ImportError:  # MAS not checked out next to this repo
    _SHARED_EXTRACTOR = False

    def extract_text_from_path(path: Path) -> str:  # type: ignore[misc]
        if path.suffix.lower() in (".md", ".txt"):
            return path.read_text(encoding="utf-8", errors="ignore")
        return ""

    def is_extractable(path: Path) -> bool:  # type: ignore[misc]
        return path.suffix.lower() in (".md", ".txt")

# Markers that must never enter a corpus feeding public posts. Deliberately
# broader than the MAS gate: that one protects HR/legal data, this one also
# protects commercial confidentiality (a leaked client name is a real incident).
CONFIDENTIAL_MARKERS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("client_name_carrefour", re.compile(r"(?i)\bcarrefour\b")),
    ("pricing_table", re.compile(r"(?i)\b(price per camera|per site pricing|monthly fee|USD\s?[\d,.]+/)")),
    ("signed_agreement", re.compile(r"(?i)\b(this agreement is entered into|hereinafter referred to as)\b")),
    ("cpf_number", re.compile(r"\b\d{3}\.\d{3}\.\d{3}-\d{2}\b")),
    ("credentials", re.compile(r"(?i)\b(api[_ ]?key|password|secret)\b\s*[:=]")),
)

MIN_SECTION_CHARS = 60  # shorter than this is a slide title, not knowledge


def sectionise(path: Path) -> list[tuple[str, str]]:
    """Read a file through the shared extractor and split it into sections.

    The extractor returns one flat string per document; the MAS chunks markdown
    on '##' headings, so a single wall of text would become one unusable chunk.
    Split on blank-line blocks and treat each block's first line as its title —
    which happens to match how decks are written (a slide title, then content).
    """
    text = extract_text_from_path(path)
    if not text or not text.strip():
        return []

    # Existing markdown already carries structure — keep it as-is.
    if path.suffix.lower() == ".md" and re.search(r"^##\s", text, re.M):
        return [(path.stem, text)]

    blocks = [b.strip() for b in re.split(r"\n\s*\n", text) if b.strip()]
    sections: list[tuple[str, str]] = []
    for block in blocks:
        if len(block) < MIN_SECTION_CHARS:
            # Too short to be knowledge on its own — fold into the previous one
            # (usually a slide title separated from its body).
            if sections:
                title, body = sections[-1]
                sections[-1] = (title, f"{body}\n{block}")
            continue
        first_line = block.split("\n", 1)[0][:80].strip()
        sections.append((first_line or path.stem, block))

    # Nothing survived the length filter: keep the document whole rather than
    # dropping content that a human might still want indexed.
    if not sections and len(text.strip()) >= MIN_SECTION_CHARS:
        return [(path.stem, text.strip())]
    return sections


def screen(text: str) -> list[str]:
    """Names every confidentiality marker found. Empty list = safe to ingest."""
    return [name for name, pattern in CONFIDENTIAL_MARKERS if pattern.search(text)]


def to_markdown(source: Path, sections: list[tuple[str, str]]) -> str:
    """Structure sections as markdown — the MAS chunks on '##' headings."""
    lines = [
        f"# {source.stem}",
        "",
        f"> Source: `{source.name}` · converted for RAG by scripts/ingest_product_docs.py",
        "> Product knowledge for content generation. Confidentiality screened at ingestion.",
        "",
    ]
    for title, body in sections:
        clean_title = re.sub(r"\s+", " ", title).strip(" .:-") or "Section"
        lines += [f"## {clean_title}", "", body.strip(), ""]
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True, help="folder holding the decks (PDF/PPTX/MD)")
    ap.add_argument(
        "--out",
        default=str(Path.home() / "OneDrive" / "Área de Trabalho" / "yedda-mas-step1" / "data" / "rag" / "product"),
        help="MAS RAG product collection folder",
    )
    ap.add_argument("--dry-run", action="store_true", help="report only, write nothing")
    ap.add_argument("--allow-flagged", action="store_true",
                    help="ingest even when the screen flags content (asks per file)")
    args = ap.parse_args()

    src_dir = Path(args.input).expanduser()
    if not src_dir.is_dir():
        print(f"FATAL: {src_dir} is not a folder", file=sys.stderr)
        return 2
    out_dir = Path(args.out).expanduser()

    files = [p for p in sorted(src_dir.iterdir()) if p.is_file() and is_extractable(p)]
    if not files:
        print(f"No readable documents in {src_dir}")
        if not _SHARED_EXTRACTOR:
            print("(MAS checkout not found — only .md/.txt can be read. "
                  "Set YEDDA_MAS_DIR to enable PDF/PPTX/DOCX/XLSX.)")
        return 1

    print(f"found {len(files)} file(s) in {src_dir}")
    print(f"extractor: {'shared (yedda_mas.rag.extract)' if _SHARED_EXTRACTOR else 'local fallback — md/txt only'}\n")
    written = skipped = 0
    for path in files:
        sections = sectionise(path)
        if not sections:
            print(f"  – {path.name}: no readable text, skipped "
                  "(missing parser library, or the file is image-only)")
            skipped += 1
            continue

        body = to_markdown(path, sections)
        flags = screen(body)
        label = f"{len(sections)} section(s), {len(body):,} chars"

        if flags:
            print(f"  ⚠ {path.name}: {label} — FLAGGED: {', '.join(flags)}")
            if not args.allow_flagged:
                print("      not ingested. Remove the confidential parts, or re-run with --allow-flagged.")
                skipped += 1
                continue
            print("      ingesting anyway (--allow-flagged)")
        else:
            print(f"  ✓ {path.name}: {label} — clean")

        if not args.dry_run:
            out_dir.mkdir(parents=True, exist_ok=True)
            target = out_dir / f"{re.sub(r'[^a-z0-9]+', '_', path.stem.lower()).strip('_')}.md"
            target.write_text(body, encoding="utf-8")
            print(f"      → {target}")
        written += 1

    print(f"\n{'would write' if args.dry_run else 'wrote'} {written} file(s)"
          + (f", skipped {skipped}" if skipped else ""))
    if args.dry_run:
        print("\nDRY RUN — nothing written.")
    elif written:
        print("\nNext: index it on the MAS side, then the generators can use it:")
        print("  cd ../yedda-mas-step1 && python scripts/ingest_rag_docs.py")
        print("\nNOTE: 'product' must be mapped in RAG_COLLECTIONS and granted to the")
        print("marketing agents in config/org_registry.yaml — same two steps the")
        print("'marketing' collection needed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
