"""Keep the cloud mirror in sync with the local MAS — both directions.

Everything the nine rounds wired up (brand voice, worked examples, verticals,
canonical vocabulary) is served by a MAS that runs on one laptop. Roi opens the
same URL and silently gets the offline fallbacks. This script is what makes the
two machines see the same product:

  push  MAS assets  -> Supabase (via /api/mas-mirror?action=sync)
  pull  revisions   <- Supabase (whatever Roi saved while the MAS was down)

The pull is the half that matters most: without it, every edit Roi makes with
the MAS offline is a learning signal that never arrives. Revisions are marked
consumed only after the MAS has stored them, so a crash mid-run repeats work
instead of losing it.

Usage:
    python -X utf8 scripts/sync_mas_mirror.py             # push + pull
    python -X utf8 scripts/sync_mas_mirror.py --push-only
    python -X utf8 scripts/sync_mas_mirror.py --pull-only
    python -X utf8 scripts/sync_mas_mirror.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

MAS = os.environ.get("MAS_BASE_URL", "http://localhost:8000")
PLATFORM = os.environ.get("PLATFORM_BASE_URL", "https://yedda-marketing-dashboard.vercel.app")
MIRROR_ENDPOINT = f"{PLATFORM}/api/mas-mirror"

# The MAS repo owns the secret; we read it from its .env so there is exactly one
# copy of the value on this machine.
MAS_ROOT = Path(os.environ.get(
    "MAS_ROOT", r"C:\Users\Admin\OneDrive\Área de Trabalho\yedda-mas-step1",
))

# Assets to mirror. The channels matter: the personal channel is Roi's, and it
# was the one that spent the whole integration silently unwired (bug 2).
ASSETS = [
    ("verticals", "/api/v1/marketing/verticals"),
    ("forbidden_vocabulary", "/api/v1/marketing/forbidden-vocabulary"),
    ("examples:linkedin_post", "/api/v1/marketing/examples?channel=linkedin_post"),
    ("examples:linkedin_post_personal", "/api/v1/marketing/examples?channel=linkedin_post_personal"),
    ("examples:all", "/api/v1/marketing/examples"),
]


def _secret() -> str:
    env = MAS_ROOT / ".env"
    if not env.exists():
        return ""
    for line in env.read_text(encoding="utf-8", errors="replace").splitlines():
        if line.startswith("QUEUE_INTAKE_SECRET="):
            return line.split("=", 1)[1].strip()
    return ""


def _get(url: str, headers: dict | None = None, timeout: int = 20):
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def _post(url: str, payload: dict, headers: dict, timeout: int = 30):
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={**headers, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def push(secret: str, dry_run: bool) -> int:
    """MAS assets -> cloud."""
    hdr = {"X-Intake-Secret": secret} if secret else {}
    pushed = 0
    for key, path in ASSETS:
        try:
            payload = _get(f"{MAS}{path}")
        except Exception as exc:
            print(f"  [skip] {key}: MAS unreachable or route missing ({exc})")
            continue

        # An empty asset is worth mirroring (it is the truth), but say so — a
        # silent zero is how "it worked" and "it delivered" drift apart.
        size = payload.get("count", "?") if isinstance(payload, dict) else "?"
        if dry_run:
            print(f"  [dry] {key}: would push (count={size})")
            pushed += 1
            continue
        try:
            _post(f"{MIRROR_ENDPOINT}?action=sync", {"key": key, "payload": payload}, hdr)
            print(f"  [ok]  {key}: pushed (count={size})")
            pushed += 1
        except urllib.error.HTTPError as exc:
            print(f"  [FAIL] {key}: {exc.code} {exc.read().decode('utf-8', 'replace')[:120]}")
    return pushed


def pull(secret: str, dry_run: bool) -> int:
    """Revisions saved anywhere -> the MAS store."""
    hdr = {"X-Intake-Secret": secret} if secret else {}
    try:
        data = _get(f"{MIRROR_ENDPOINT}?revisions=pending", hdr)
    except urllib.error.HTTPError as exc:
        print(f"  [FAIL] cannot read pending revisions: {exc.code}")
        return 0
    rows = data.get("revisions") or []
    if not rows:
        print("  [ok]  no pending revisions")
        return 0

    if dry_run:
        print(f"  [dry] would import {len(rows)} revision(s)")
        return len(rows)

    sys.path.insert(0, str(MAS_ROOT / "src"))
    try:
        from yedda_mas.memory.content_pairs import ContentPairStore
    except ImportError as exc:
        print(f"  [FAIL] MAS not importable ({exc}) — run this from a machine with the MAS repo")
        return 0

    # ContentPairStore defaults to Path("data")/… — relative to the *working
    # directory*, not to the MAS. Run from this repo and the pairs land in
    # Marketing agent/data/, where the MAS will never read them: the sync
    # reports success, the store stays at 18, and the revision is already
    # marked consumed. Bug 7 verbatim. Pin the absolute path.
    pairs_path = MAS_ROOT / "data" / "content_pairs.jsonl"
    if not pairs_path.parent.exists():
        print(f"  [FAIL] {pairs_path.parent} does not exist — is MAS_ROOT correct?")
        return 0
    store = ContentPairStore(path=pairs_path)
    imported: list[str] = []
    rejected = 0
    for row in rows:
        try:
            # record() returns False (never raises) when the revision is too
            # short to teach from. Consuming on a False would mark as delivered
            # something the MAS refused to store — the bug-5 shape, again.
            stored = store.record(
                pair_id=row["pair_id"],
                channel=row.get("channel") or "linkedin_post",
                draft=row.get("draft") or "",
                published=row["published"],
                note=row.get("topic") or "",
            )
            if stored:
                imported.append(row["pair_id"])
            else:
                rejected += 1
                print(f"  [skip] {row.get('pair_id')}: rejected by the store (too short to teach from)")
        except Exception as exc:
            print(f"  [skip] {row.get('pair_id')}: {exc}")

    if rejected:
        print(f"  [warn] {rejected} revision(s) stay pending — they will be retried next run")

    if imported:
        # Only now — marking before storing would lose revisions on a crash.
        _post(f"{MIRROR_ENDPOINT}?action=consume", {"pair_ids": imported}, hdr)
        print(f"  [ok]  imported and consumed {len(imported)} revision(s)")
    return len(imported)


def main() -> int:
    ap = argparse.ArgumentParser(description="Sync the MAS with its cloud mirror")
    ap.add_argument("--push-only", action="store_true")
    ap.add_argument("--pull-only", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    secret = _secret()
    print(f"MAS      : {MAS}")
    print(f"Mirror   : {MIRROR_ENDPOINT}")
    print(f"Secret   : {'loaded' if secret else 'none (mirror must be open)'}")
    print()

    ok = True
    if not args.pull_only:
        print("PUSH (MAS assets -> cloud)")
        if push(secret, args.dry_run) == 0:
            ok = False
        print()
    if not args.push_only:
        print("PULL (revisions -> MAS)")
        pull(secret, args.dry_run)
        print()

    print("done" if ok else "done with failures — see [FAIL] above")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
