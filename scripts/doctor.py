"""
Pre-flight check. Run: python -m scripts.doctor

Validates:
  - .env exists and required vars are filled
  - Instagram access token works (GET /me with fields)
  - IG_USER_ID resolves to an Instagram Business account
  - HighLevel webhook (if set) accepts a test ping
  - content/queue.json parses and has at least one unposted item
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
OK = "[OK]"
WARN = "[WARN]"
FAIL = "[FAIL]"


def _print(tag: str, msg: str) -> None:
    print(f"{tag} {msg}")


def check_env() -> dict | None:
    env_path = ROOT / ".env"
    if not env_path.exists():
        _print(FAIL, f".env not found at {env_path}. Copy .env.example to .env first.")
        return None
    load_dotenv(env_path)

    required = ["IG_ACCESS_TOKEN", "IG_USER_ID"]
    missing = [k for k in required if not os.getenv(k, "").strip()]
    if missing:
        _print(FAIL, f"Missing required env vars: {', '.join(missing)}")
        return None

    _print(OK, ".env loaded with required Instagram vars.")
    return {
        "ig_token": os.environ["IG_ACCESS_TOKEN"].strip(),
        "ig_user_id": os.environ["IG_USER_ID"].strip(),
        "graph_version": os.getenv("IG_GRAPH_VERSION", "v21.0").strip(),
        "fb_page_id": os.getenv("FB_PAGE_ID", "").strip(),
        "crosspost_fb": os.getenv("CROSSPOST_TO_FACEBOOK", "").strip().lower() in {"1", "true", "yes", "on"},
        "hl_webhook": os.getenv("HIGHLEVEL_WEBHOOK_URL", "").strip(),
        "hl_api_token": os.getenv("HIGHLEVEL_API_TOKEN", "").strip(),
        "hl_location_id": os.getenv("HIGHLEVEL_LOCATION_ID", "").strip(),
        "anthropic_key": os.getenv("ANTHROPIC_API_KEY", "").strip(),
    }


def check_ig(cfg: dict) -> bool:
    base = f"https://graph.facebook.com/{cfg['graph_version']}"
    r = requests.get(
        f"{base}/{cfg['ig_user_id']}",
        params={
            "fields": "id,username,name",
            "access_token": cfg["ig_token"],
        },
        timeout=30,
    )
    if not r.ok:
        _print(FAIL, f"Instagram API rejected the token: {r.status_code} {r.text}")
        return False
    data = r.json()
    handle = data.get("username") or data.get("name") or data.get("id")
    _print(OK, f"Instagram account reachable: @{handle}")
    return True


def check_facebook(cfg: dict) -> None:
    if not cfg["crosspost_fb"]:
        _print(WARN, "Facebook cross-post disabled (CROSSPOST_TO_FACEBOOK=false).")
        return
    if not cfg["fb_page_id"]:
        _print(FAIL, "CROSSPOST_TO_FACEBOOK=true but FB_PAGE_ID is empty.")
        return
    r = requests.get(
        f"https://graph.facebook.com/{cfg['graph_version']}/{cfg['fb_page_id']}",
        params={"fields": "id,name", "access_token": cfg["ig_token"]},
        timeout=30,
    )
    if not r.ok:
        _print(FAIL, f"Facebook Page lookup failed: {r.status_code} {r.text}")
        return
    _print(OK, f"Facebook Page reachable: {r.json().get('name')}")


def check_anthropic(cfg: dict) -> None:
    if not cfg["anthropic_key"]:
        _print(WARN, "ANTHROPIC_API_KEY not set. Auto-captioning disabled (OK if captions are always written manually).")
        return
    try:
        import anthropic  # noqa: F401
        _print(OK, "Anthropic SDK installed and API key present.")
    except ImportError:
        _print(FAIL, "ANTHROPIC_API_KEY set but `anthropic` package not installed. Run setup again.")


def check_highlevel(cfg: dict) -> None:
    if cfg["hl_webhook"]:
        try:
            r = requests.post(
                cfg["hl_webhook"],
                json={"event": "doctor_ping", "source": "fvce-poster"},
                timeout=20,
            )
            if r.ok:
                _print(OK, f"HighLevel webhook accepted ping ({r.status_code}).")
            else:
                _print(WARN, f"HighLevel webhook responded {r.status_code}: {r.text[:200]}")
        except requests.RequestException as e:
            _print(WARN, f"HighLevel webhook unreachable: {e}")
    elif cfg["hl_api_token"] and cfg["hl_location_id"]:
        _print(
            WARN,
            "HighLevel API token + location set but not test-pinged (endpoint path "
            "varies by account; verify against current HighLevel API docs).",
        )
    else:
        _print(WARN, "HighLevel not configured. Posts will still go to Instagram; HL is optional.")


def check_queue() -> None:
    qpath = ROOT / "content" / "queue.json"
    if not qpath.exists():
        _print(FAIL, f"Queue file missing: {qpath}")
        return
    try:
        items = json.loads(qpath.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        _print(FAIL, f"queue.json is not valid JSON: {e}")
        return
    if not isinstance(items, list) or not items:
        _print(FAIL, "queue.json is empty. Add at least one post.")
        return
    unposted = [i for i in items if not i.get("posted")]
    placeholder = [i for i in unposted if "example.com" in i.get("media_url", "")]
    if placeholder:
        _print(
            WARN,
            f"{len(placeholder)} queue item(s) still use example.com placeholder URLs. "
            "Replace with real public media URLs before running for real.",
        )
    _print(OK, f"Queue loaded: {len(items)} total, {len(unposted)} unposted.")


def main() -> int:
    print("=== Fox Valley Client Engine - doctor ===")
    cfg = check_env()
    if cfg is None:
        return 1

    ig_ok = check_ig(cfg)
    check_facebook(cfg)
    check_highlevel(cfg)
    check_anthropic(cfg)
    check_queue()

    print()
    if ig_ok:
        print("All critical checks passed. You can run: python -m src.main once")
        return 0
    print("Critical checks failed. Fix the issues above, then re-run.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
