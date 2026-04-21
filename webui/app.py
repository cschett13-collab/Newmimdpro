"""
Minimal local web UI for managing content/queue.json.

Run:
    scripts\\run.bat webui      (Windows)
    ./scripts/run.sh webui      (Mac/Linux)

Then open http://127.0.0.1:5050 in a browser.

This binds to localhost only and has no auth; do not expose it to the internet.
"""
from __future__ import annotations

import json
from pathlib import Path

from flask import Flask, redirect, render_template, request, url_for

ROOT = Path(__file__).resolve().parent.parent
QUEUE = ROOT / "content" / "queue.json"

app = Flask(__name__, template_folder=str(Path(__file__).parent / "templates"))


def _load() -> list[dict]:
    if not QUEUE.exists():
        return []
    return json.loads(QUEUE.read_text(encoding="utf-8"))


def _save(items: list[dict]) -> None:
    tmp = QUEUE.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(items, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(QUEUE)


@app.get("/")
def index():
    return render_template("index.html", items=_load())


@app.post("/add")
def add():
    item = {
        "media_url": request.form.get("media_url", "").strip(),
        "media_type": request.form.get("media_type", "image").strip(),
        "caption": request.form.get("caption", "").strip(),
        "hint": request.form.get("hint", "").strip(),
        "posted": False,
        "posted_at": None,
        "media_id": None,
    }
    if not item["media_url"]:
        return redirect(url_for("index"))
    items = _load()
    items.append(item)
    _save(items)
    return redirect(url_for("index"))


@app.post("/delete/<int:index>")
def delete(index: int):
    items = _load()
    if 0 <= index < len(items):
        items.pop(index)
        _save(items)
    return redirect(url_for("index"))


@app.post("/move/<int:index>/<direction>")
def move(index: int, direction: str):
    items = _load()
    if direction == "up" and index > 0:
        items[index - 1], items[index] = items[index], items[index - 1]
    elif direction == "down" and index < len(items) - 1:
        items[index + 1], items[index] = items[index], items[index + 1]
    _save(items)
    return redirect(url_for("index"))


def main() -> None:
    app.run(host="127.0.0.1", port=5050, debug=False)


if __name__ == "__main__":
    main()
