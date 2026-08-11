#!/usr/bin/env python
"""Seed the MAS content-pair corpus from Roi's editorial spreadsheet.

The spreadsheet is the real production history: the AI's draft ("Yedda Post"),
what Roi actually published ("Final Post"), his verdict and his review comment.
Each draft→published pair is a worked example the MAS feeds back into
generation, so the corpus starts with real history instead of empty.

Usage:
    python scripts/seed_editorial_pairs.py --dry-run     # inspect, write nothing
    python scripts/seed_editorial_pairs.py               # POST to the MAS

Input: a JSON export of the sheet (see --input). Kept out of the repo because
the sheet is the CEO's working document; export it locally before running.
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

# Spreadsheet columns (0-indexed) — from the actual export
COL_DRAFT = 4        # "Yedda Post"     — what the AI wrote
COL_ROI_POST = 6     # "Roi Post"       — personal-voice draft
COL_VERDICT = 8      # "Roi"            — Yes / No
COL_NOTE = 9         # "Roi's comment"  — why it was rejected/changed
COL_FINAL = 11       # "Final Post"     — what was actually published

MIN_LEN = 40         # the MAS rejects anything shorter with 422


def parse_rows(markdown_table: str) -> list[list[str]]:
    """Extract data rows from the markdown table the Drive export produces."""
    lines = [ln for ln in markdown_table.split("\n") if ln.strip().startswith("|")]
    rows = []
    for line in lines[3:]:  # skip the two layout rows and the header
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) >= 12 and any(cells):
            rows.append(cells)
    return rows


def build_pairs(rows: list[list[str]]) -> list[dict]:
    """Turn spreadsheet rows into revision payloads.

    A pair only teaches something when both sides are substantial AND actually
    differ — identical text means the reviewer changed nothing.
    """
    pairs = []
    for n, row in enumerate(rows, start=1):
        def cell(idx: str | int) -> str:
            return row[idx].strip() if idx < len(row) else ""

        published = cell(COL_FINAL)
        # Company post first; fall back to the personal-voice draft.
        draft = cell(COL_DRAFT) or cell(COL_ROI_POST)
        channel = "linkedin_post" if cell(COL_DRAFT) else "linkedin_post_personal"

        if len(draft) < MIN_LEN or len(published) < MIN_LEN:
            continue
        if draft == published:
            continue

        note = cell(COL_NOTE)
        verdict = cell(COL_VERDICT)
        if verdict and verdict.lower() in ("yes", "no"):
            note = f"[verdict: {verdict}] {note}".strip()

        pairs.append({
            "pair_id": f"sheet-2026-row{n:02d}",
            "channel": channel,
            "draft": draft,
            "published": published,
            "author": "roi",
            **({"note": note} if note else {}),
        })
    return pairs


def post_pair(base: str, pair: dict, timeout: int = 20) -> tuple[bool, dict | str]:
    """POST one pair. Tries the versioned path, falls back to the plain one."""
    body = json.dumps(pair).encode("utf-8")
    last: str = "no endpoint reachable"
    for prefix in ("/api/v1/marketing", "/api/marketing"):
        req = urllib.request.Request(
            f"{base}{prefix}/revision", data=body,
            headers={"Content-Type": "application/json"}, method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return True, json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8")[:200]
            if exc.code == 404:      # wrong prefix — try the other one
                last = f"HTTP 404 at {prefix}"
                continue
            return False, f"HTTP {exc.code}: {detail}"
        except Exception as exc:      # noqa: BLE001 — network/host problems
            last = str(exc)
    return False, last


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default="data/editorial-sheet.json",
                    help="JSON export of the sheet: {\"fileContent\": \"<markdown table>\"}")
    ap.add_argument("--mas", default="http://localhost:8000", help="MAS dashboard base URL")
    ap.add_argument("--dry-run", action="store_true", help="parse and report, write nothing")
    args = ap.parse_args()

    src = Path(args.input)
    if not src.exists():
        print(f"FATAL: {src} not found.\n"
              f"Export the sheet to that path first (JSON with a 'fileContent' key).",
              file=sys.stderr)
        return 2

    raw = json.loads(src.read_text(encoding="utf-8"))
    content = raw["fileContent"] if isinstance(raw, dict) else str(raw)
    rows = parse_rows(content)
    pairs = build_pairs(rows)

    print(f"rows parsed: {len(rows)}  |  usable draft→published pairs: {len(pairs)}")
    for p in pairs:
        print(f"  {p['pair_id']}  {p['channel']:<24} draft {len(p['draft']):>5} → published {len(p['published']):>5}")

    if args.dry_run:
        print("\nDRY RUN — nothing sent.")
        return 0
    if not pairs:
        print("\nNothing to seed.")
        return 1

    print(f"\nseeding into {args.mas} …")
    ok = failed = 0
    sims: list[float] = []
    for p in pairs:
        success, result = post_pair(args.mas, p)
        if success:
            ok += 1
            sim = result.get("similarity")
            if isinstance(sim, (int, float)):
                sims.append(float(sim))
            print(f"  ✓ {p['pair_id']}  similarity={sim}")
        else:
            failed += 1
            print(f"  ✗ {p['pair_id']}  {result}")

    print(f"\nseeded {ok}/{len(pairs)}" + (f", {failed} failed" if failed else ""))
    if sims:
        mean = sum(sims) / len(sims)
        print(f"mean similarity: {mean:.4f}  ({mean * 100:.1f}% of the draft survives on average)")
        if not 0.02 <= mean <= 0.30:
            print("NOTE: outside the 5–15% measured on the sheet — worth double-checking the mapping.")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
