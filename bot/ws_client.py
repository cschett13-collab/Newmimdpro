"""CLOB market WebSocket client.

Subscribes to the public market channel for a list of asset (token) ids and
forwards `book` and `price_change` messages to per-token `OrderBook`s. The
strategy is notified asynchronously after every applied update.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Awaitable, Callable, Dict, Iterable, Optional

import websockets
from websockets.exceptions import ConnectionClosed

from .orderbook import OrderBook

log = logging.getLogger(__name__)

UpdateCallback = Callable[[str, OrderBook], Awaitable[None]]


class MarketStream:
    def __init__(
        self,
        ws_host: str,
        token_ids: Iterable[str],
        on_update: UpdateCallback,
        default_tick: float = 0.01,
    ) -> None:
        self._ws_host = ws_host
        self._token_ids = list(token_ids)
        self._on_update = on_update
        self.books: Dict[str, OrderBook] = {
            t: OrderBook(token_id=t, tick_size=default_tick) for t in self._token_ids
        }
        self._stop = asyncio.Event()

    async def run(self) -> None:
        """Reconnect loop. Each reconnect re-subscribes and waits for snapshots."""
        backoff = 1.0
        while not self._stop.is_set():
            try:
                await self._run_once()
                backoff = 1.0
            except (ConnectionClosed, OSError) as exc:
                log.warning("WS dropped: %s. reconnecting in %.1fs", exc, backoff)
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 30.0)

    def stop(self) -> None:
        self._stop.set()

    # ------------------------------------------------------------------

    async def _run_once(self) -> None:
        async with websockets.connect(
            self._ws_host, ping_interval=10, ping_timeout=10, close_timeout=2
        ) as ws:
            await ws.send(
                json.dumps(
                    {"type": "MARKET", "assets_ids": self._token_ids}
                )
            )
            log.info("subscribed to %d token(s)", len(self._token_ids))
            async for raw in ws:
                await self._dispatch(raw)
                if self._stop.is_set():
                    break

    async def _dispatch(self, raw: str) -> None:
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            log.debug("non-json frame: %s", raw[:120])
            return

        # Polymarket sometimes batches events into a list.
        events = msg if isinstance(msg, list) else [msg]
        for ev in events:
            await self._apply(ev)

    async def _apply(self, ev: dict) -> None:
        token = ev.get("asset_id") or ev.get("market") or ev.get("token_id")
        if token not in self.books:
            return
        book = self.books[token]
        etype = ev.get("event_type") or ev.get("type")

        if etype in ("book", "BOOK"):
            book.apply_snapshot(ev.get("bids", []), ev.get("asks", []))
        elif etype in ("price_change", "PRICE_CHANGE"):
            book.apply_changes(ev.get("changes", []))
        elif etype in ("tick_size_change", "TICK_SIZE_CHANGE"):
            new_tick = ev.get("new_tick_size") or ev.get("tick_size")
            if new_tick is not None:
                book.tick_size = float(new_tick)
            return
        else:
            return

        book.last_update_ts = time.time()
        await self._on_update(token, book)
