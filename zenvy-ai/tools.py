"""Web/API tools for Zenvy AI.

Auto-discovery: each tool declares which env vars it needs. At module load,
only tools whose env vars are present get exposed to the model. Add an API
key to .env and restart -> the tool lights up. No code changes needed.

Currently registered integrations:
  - core      (always on)            -> web_search, fetch_url
  - serpapi   (SERPAPI_API_KEY)      -> serpapi_search   (better than DDG)
  - apify     (APIFY_API_TOKEN)      -> run_apify_actor  (6000+ Actors)
  - resend    (RESEND_API_KEY)       -> send_email
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Awaitable, Callable

import httpx
from bs4 import BeautifulSoup

log = logging.getLogger("zenvy.tools")

USER_AGENT = "Mozilla/5.0 (compatible; ZenvyAI/1.0; +https://github.com/cschett13-collab/Newmimdpro)"
HTTP_TIMEOUT = 20.0


# ============================================================
# Tool implementations
# ============================================================

# ---- core (always on) ----

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


# ---- serpapi (better web search) ----

async def serpapi_search(query: str, max_results: int = 5) -> str:
    key = os.getenv("SERPAPI_API_KEY", "")
    if not key:
        return "Error: SERPAPI_API_KEY not set"
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as c:
        r = await c.get(
            "https://serpapi.com/search.json",
            params={"q": query, "api_key": key, "num": max_results},
        )
        if r.status_code >= 400:
            return f"SerpAPI error {r.status_code}: {r.text[:300]}"
    data = r.json()
    results = data.get("organic_results", [])[:max_results]
    out = [{"title": r.get("title"), "url": r.get("link"), "snippet": r.get("snippet")} for r in results]
    return json.dumps(out, ensure_ascii=False)


# ---- apify (run any Actor) ----

async def run_apify_actor(actor_id: str, input: dict | None = None, max_items: int = 20) -> str:
    token = os.getenv("APIFY_API_TOKEN", "")
    if not token:
        return "Error: APIFY_API_TOKEN not set"
    actor_path = actor_id.replace("/", "~")
    url = f"https://api.apify.com/v2/acts/{actor_path}/run-sync-get-dataset-items"
    params = {"token": token, "limit": max(1, min(max_items, 100))}
    async with httpx.AsyncClient(timeout=120.0) as c:
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


# ---- resend (send email) ----

async def send_email(to: str, subject: str, html: str, from_email: str | None = None) -> str:
    key = os.getenv("RESEND_API_KEY", "")
    if not key:
        return "Error: RESEND_API_KEY not set"
    sender = from_email or os.getenv("RESEND_FROM", "")
    if not sender:
        return "Error: RESEND_FROM not set (use a verified sender from Resend)"
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as c:
        r = await c.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={"from": sender, "to": [to], "subject": subject, "html": html},
        )
    if r.status_code >= 400:
        return f"Resend error {r.status_code}: {r.text[:300]}"
    return f"Sent to {to}: {r.json().get('id', 'ok')}"


# ============================================================
# Auto-discovery — define each integration's required env, schemas, handler
# ============================================================

class Integration:
    def __init__(
        self,
        name: str,
        env_required: list[str],
        schemas: list[dict[str, Any]],
        handlers: dict[str, Callable[..., Awaitable[str]]],
    ) -> None:
        self.name = name
        self.env_required = env_required
        self.schemas = schemas
        self.handlers = handlers

    def is_available(self) -> bool:
        return all(os.getenv(v) for v in self.env_required)


_INTEGRATIONS: list[Integration] = [
    Integration(
        name="core",
        env_required=[],
        schemas=[
            {
                "type": "function",
                "function": {
                    "name": "web_search",
                    "description": "Search the web (DuckDuckGo) and return the top results as JSON.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {"type": "string"},
                            "max_results": {"type": "integer"},
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
                            "url": {"type": "string"},
                            "max_chars": {"type": "integer"},
                        },
                        "required": ["url"],
                    },
                },
            },
        ],
        handlers={"web_search": web_search, "fetch_url": fetch_url},
    ),
    Integration(
        name="serpapi",
        env_required=["SERPAPI_API_KEY"],
        schemas=[
            {
                "type": "function",
                "function": {
                    "name": "serpapi_search",
                    "description": (
                        "Higher-quality Google search via SerpAPI. Prefer over web_search "
                        "when accuracy matters (news, specific facts, recent events)."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {"type": "string"},
                            "max_results": {"type": "integer"},
                        },
                        "required": ["query"],
                    },
                },
            }
        ],
        handlers={"serpapi_search": serpapi_search},
    ),
    Integration(
        name="apify",
        env_required=["APIFY_API_TOKEN"],
        schemas=[
            {
                "type": "function",
                "function": {
                    "name": "run_apify_actor",
                    "description": (
                        "Run any of Apify's 6000+ pre-built Actors (Instagram, TikTok, "
                        "Google Maps, LinkedIn, Twitter, YouTube, generic web scraper, etc.)."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "actor_id": {
                                "type": "string",
                                "description": "e.g. 'apify/instagram-scraper', 'apify/google-maps-scraper'",
                            },
                            "input": {"type": "object"},
                            "max_items": {"type": "integer"},
                        },
                        "required": ["actor_id"],
                    },
                },
            }
        ],
        handlers={"run_apify_actor": run_apify_actor},
    ),
    Integration(
        name="resend",
        env_required=["RESEND_API_KEY", "RESEND_FROM"],
        schemas=[
            {
                "type": "function",
                "function": {
                    "name": "send_email",
                    "description": "Send a transactional email via Resend (HTML body).",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "to": {"type": "string"},
                            "subject": {"type": "string"},
                            "html": {"type": "string"},
                            "from_email": {"type": "string"},
                        },
                        "required": ["to", "subject", "html"],
                    },
                },
            }
        ],
        handlers={"send_email": send_email},
    ),
]


def _build_active() -> tuple[list[dict[str, Any]], dict[str, Callable[..., Awaitable[str]]], list[str]]:
    schemas: list[dict[str, Any]] = []
    handlers: dict[str, Callable[..., Awaitable[str]]] = {}
    active_names: list[str] = []
    for integ in _INTEGRATIONS:
        if integ.is_available():
            schemas.extend(integ.schemas)
            handlers.update(integ.handlers)
            active_names.append(integ.name)
        else:
            log.info("integration disabled (env missing): %s -> needs %s", integ.name, integ.env_required)
    return schemas, handlers, active_names


TOOL_SCHEMAS, _HANDLERS, ACTIVE_INTEGRATIONS = _build_active()
log.info("active integrations: %s (tools: %s)", ACTIVE_INTEGRATIONS, list(_HANDLERS.keys()))


async def execute_tool(name: str, args: dict[str, Any]) -> str:
    fn = _HANDLERS.get(name)
    if fn is None:
        return f"Error: tool '{name}' is not enabled (check API keys in .env)"
    try:
        return await fn(**args)
    except TypeError as e:
        return f"Error: bad arguments to {name}: {e}"
    except Exception as e:
        return f"Error calling {name}: {e}"
