import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

QUEUE_FILE = Path("content/queue.json")


@dataclass
class QueueItem:
    media_url: str
    media_type: str  # "image" or "video"
    caption: str
    posted: bool = False
    posted_at: str | None = None
    media_id: str | None = None


class ContentQueue:
    """
    JSON-backed queue of posts. Atomically picks the next unposted item
    and marks it posted after a successful publish.

    queue.json schema:
      [
        {
          "media_url": "https://...",
          "media_type": "image" | "video",
          "caption": "...",
          "posted": false,
          "posted_at": null,
          "media_id": null
        }
      ]
    """

    def __init__(self, path: Path = QUEUE_FILE):
        self.path = path

    def _load(self) -> list[dict]:
        if not self.path.exists():
            return []
        with self.path.open("r", encoding="utf-8") as f:
            return json.load(f)

    def _save(self, items: list[dict]) -> None:
        tmp = self.path.with_suffix(".json.tmp")
        with tmp.open("w", encoding="utf-8") as f:
            json.dump(items, f, indent=2, ensure_ascii=False)
        tmp.replace(self.path)

    def next_unposted(self) -> tuple[int, QueueItem] | None:
        items = self._load()
        for i, raw in enumerate(items):
            if not raw.get("posted"):
                return i, QueueItem(
                    media_url=raw["media_url"],
                    media_type=raw.get("media_type", "image"),
                    caption=raw.get("caption", ""),
                    posted=False,
                )
        return None

    def mark_posted(self, index: int, media_id: str) -> None:
        items = self._load()
        if index >= len(items):
            raise IndexError(f"Queue index {index} out of range")
        items[index]["posted"] = True
        items[index]["posted_at"] = datetime.now(timezone.utc).isoformat()
        items[index]["media_id"] = media_id
        self._save(items)
