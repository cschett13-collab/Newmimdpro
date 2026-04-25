"""Web tools for Zenvy AI: DuckDuckGo search + URL fetch.

These are exposed to the model via OpenAI-compatible function calling.
Ollama's /v1/chat/completions supports the same tool format as OpenAI.
"""
from __future__ import annotations

import json
from typing import Any, Awaitable, Callable

import httpx
from bs4 import BeautifulSoup

USER_AGENT = "Mozilla/5.0 (compatible; ZenvyAI/1.0; +https://github.com/cschett13-collab/Newmimdpro)"
HTTP_TIMEOUT = 20.0


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
]


_HANDLERS: dict[str, Callable[..., Awaitable[str]]] = {
    "web_search": web_search,
    "fetch_url": fetch_url,
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
