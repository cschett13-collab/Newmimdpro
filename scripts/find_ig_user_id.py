"""
Helper: given a long-lived user access token, print every Facebook Page you
manage along with the linked Instagram Business account ID, so you can paste
one into .env as IG_USER_ID.

Usage:
    python -m scripts.find_ig_user_id EAAxxxxxxxxxx
    # or, if IG_ACCESS_TOKEN is already in .env:
    python -m scripts.find_ig_user_id
"""
from __future__ import annotations

import os
import sys

import requests
from dotenv import load_dotenv

GRAPH = "https://graph.facebook.com/v21.0"


def main() -> int:
    token = sys.argv[1] if len(sys.argv) > 1 else ""
    if not token:
        load_dotenv()
        token = os.getenv("IG_ACCESS_TOKEN", "").strip()
    if not token:
        print("No token provided. Pass it as an argument or set IG_ACCESS_TOKEN in .env.")
        return 2

    r = requests.get(
        f"{GRAPH}/me/accounts",
        params={"fields": "id,name,instagram_business_account", "access_token": token},
        timeout=30,
    )
    if not r.ok:
        print(f"Graph API error: {r.status_code} {r.text}")
        return 1
    data = r.json().get("data", [])
    if not data:
        print("No Facebook Pages found for this token.")
        print("Make sure the token was generated with pages_show_list permission.")
        return 1

    print(f"Found {len(data)} Page(s):\n")
    for page in data:
        ig = page.get("instagram_business_account") or {}
        ig_id = ig.get("id") or "(none - Page is not linked to an Instagram Business account)"
        print(f"  Page: {page.get('name')}")
        print(f"    page_id:    {page.get('id')}")
        print(f"    IG_USER_ID: {ig_id}")
        print()

    print("Copy the IG_USER_ID for the right Page into your .env.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
