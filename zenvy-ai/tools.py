"""Web tools for Zenvy AI: DuckDuckGo search + URL fetch.

These are exposed to the model via OpenAI-compatible function calling.
Ollama's /v1/chat/completions supports the same tool format as OpenAI.
"""
from __future__ import annotations

import json
import os
from typing import Any, Awaitable, Callable

import httpx
from bs4 import BeautifulSoup

USER_AGENT = "Mozilla/5.0 (compatible; ZenvyAI/1.0; +https://github.com/cschett13-collab/Newmimdpro)"
HTTP_TIMEOUT = 20.0
APIFY_API_TOKEN = os.getenv("APIFY_API_TOKEN", "")
APIFY_TIMEOUT = 120.0


async def web_search(query: str, max_results: int = 5) -> str:
    """DuckDuckGo HTML search — no API key required."""
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT, headers={"User-Agent": USER_AGENT}) as c:
        r = await c.get("https://html.duckduckgo.com/html/", params={"q": query})
        r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    out: list[dict[str, str]] = []
    for el in soup.select(".result")[: max(1, min(max_results, 10))]:
        title = el.select_one(".result__title")
        snippet = el.select_one(".result__snippet")
        link = el.select_one(".result__url")
        if title and link:
            out.append(
                {
                    "title": title.get_text(strip=True),
                    "url": link.get_text(strip=True),
                    "snippet": snippet.get_text(strip=True) if snippet else "",
                }
            )
    return json.dumps(out, ensure_ascii=False)


async def run_apify_actor(actor_id: str, input: dict | None = None, max_items: int = 20) -> str:
    """Run an Apify Actor (web scraper / automation) and return its dataset items.

    Browse https://apify.com/store for available actors. Examples:
      apify/instagram-scraper, apify/google-maps-scraper, apify/tiktok-scraper,
      apify/web-scraper, apify/youtube-scraper, apify/twitter-scraper-lite.
    """
    if not APIFY_API_TOKEN:
        return "Error: APIFY_API_TOKEN not set. Get a free token at apify.com -> Settings -> Integrations."
    actor_path = actor_id.replace("/", "~")
    url = f"https://api.apify.com/v2/acts/{actor_path}/run-sync-get-dataset-items"
    params = {"token": APIFY_API_TOKEN, "limit": max(1, min(max_items, 100))}
    async with httpx.AsyncClient(timeout=APIFY_TIMEOUT) as c:
        r = await c.post(url, params=params, json=input or {})
        if r.status_code >= 400:
            return f"Apify error {r.status_code}: {r.text[:500]}"
    try:
        items = r.json()
    except json.JSONDecodeError:
        return r.text[:5000]
    if not isinstance(items, list):
        return json.dumps(items, ensure_ascii=False)[:5000]
    return json.dumps(items[:max_items], ensure_ascii=False)[:8000]


async def fetch_url(url: str, max_chars: int = 6000) -> str:
    """Fetch a URL and return cleaned text (first N chars)."""
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    async with httpx.AsyncClient(
        timeout=HTTP_TIMEOUT,
        headers={"User-Agent": USER_AGENT},
        follow_redirects=True,
    ) as c:
        r = await c.get(url)
        r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "noscript"]):
        tag.decompose()
    text = soup.get_text(separator="\n", strip=True)
    text = "\n".join(line for line in text.splitlines() if line.strip())
    if len(text) > max_chars:
        text = text[:max_chars] + "\n...[truncated]"
    return text or "(empty page)"


# OpenAI-compatible tool schemas — Ollama supports the same shape.
TOOL_SCHEMAS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "Search the web (DuckDuckGo) and return the top results as JSON.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search terms."},
                    "max_results": {"type": "integer", "description": "1–10, default 5."},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "fetch_url",
            "description": "Fetch a webpage and return its main text (first ~6 KB).",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "Full URL, including https://"},
                    "max_chars": {"type": "integer", "description": "Default 6000."},
                },
                "required": ["url"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_apify_actor",
            "description": (
                "Run a pre-built scraper/automation from Apify's store of 6000+ Actors "
                "(Instagram, TikTok, Google Maps, LinkedIn, Twitter/X, YouTube, generic web "
                "scraper, etc.). Use when the user asks to scrape a platform or do bulk web "
                "automation. Requires APIFY_API_TOKEN env var."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "actor_id": {
                        "type": "string",
                        "description": (
                            "Actor ID, e.g. 'apify/instagram-scraper', 'apify/google-maps-scraper', "
                            "'apify/tiktok-scraper', 'apify/web-scraper'."
                        ),
                    },
                    "input": {
                        "type": "object",
                        "description": "Actor-specific input JSON (see the actor's README on apify.com).",
                    },
                    "max_items": {"type": "integer", "description": "Cap returned items (default 20, max 100)."},
                },
                "required": ["actor_id"],
            },
        },
    },
]


_HANDLERS: dict[str, Callable[..., Awaitable[str]]] = {
    "web_search": web_search,
    "fetch_url": fetch_url,
    "run_apify_actor": run_apify_actor,
}


async def execute_tool(name: str, args: dict[str, Any]) -> str:
    fn = _HANDLERS.get(name)
    if fn is None:
        return f"Error: unknown tool '{name}'"
    try:
        return await fn(**args)
    except TypeError as e:
        return f"Error: bad arguments to {name}: {e}"
    except Exception as e:
        return f"Error calling {name}: {e}"
