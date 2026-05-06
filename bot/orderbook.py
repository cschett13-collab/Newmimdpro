"""In-memory order book maintained from CLOB WebSocket events.

Only the data we need for quoting is tracked: best bid / best ask, mid, and
enough depth to estimate slippage on a target notional.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Optional, Tuple


@dataclass
class Level:
    price: float
    size: float


@dataclass
class OrderBook:
    token_id: str
    tick_size: float = 0.01
    bids: Dict[float, float] = field(default_factory=dict)  # price -> size
    asks: Dict[float, float] = field(default_factory=dict)
    last_update_ts: float = 0.0

    # ---- mutation -----------------------------------------------------

    def apply_snapshot(self, bids: Iterable[dict], asks: Iterable[dict]) -> None:
        self.bids.clear()
        self.asks.clear()
        for lvl in bids:
            self._set(self.bids, float(lvl["price"]), float(lvl["size"]))
        for lvl in asks:
            self._set(self.asks, float(lvl["price"]), float(lvl["size"]))

    def apply_changes(self, changes: Iterable[dict]) -> None:
        """Apply a `price_change` event: list of {price, side, size}."""
        for ch in changes:
            price = float(ch["price"])
            size = float(ch["size"])
            side = ch["side"].upper()
            book = self.bids if side == "BUY" else self.asks
            self._set(book, price, size)

    @staticmethod
    def _set(book: Dict[float, float], price: float, size: float) -> None:
        if size <= 0:
            book.pop(price, None)
        else:
            book[price] = size

    # ---- views --------------------------------------------------------

    def best_bid(self) -> Optional[Level]:
        if not self.bids:
            return None
        p = max(self.bids)
        return Level(p, self.bids[p])

    def best_ask(self) -> Optional[Level]:
        if not self.asks:
            return None
        p = min(self.asks)
        return Level(p, self.asks[p])

    def mid(self) -> Optional[float]:
        b, a = self.best_bid(), self.best_ask()
        if b is None or a is None:
            return None
        return (b.price + a.price) / 2.0

    def sorted_asks(self) -> List[Level]:
        return [Level(p, self.asks[p]) for p in sorted(self.asks)]

    def sorted_bids(self) -> List[Level]:
        return [Level(p, self.bids[p]) for p in sorted(self.bids, reverse=True)]

    # ---- slippage estimation -----------------------------------------

    def expected_fill_price(
        self, side: str, notional_usdc: float
    ) -> Optional[Tuple[float, float]]:
        """Walk the book for `side` until `notional_usdc` is filled.

        Returns (vwap, filled_size) or None if the book is too thin.
        """
        levels = self.sorted_asks() if side.upper() == "BUY" else self.sorted_bids()
        remaining = notional_usdc
        spent = 0.0
        size = 0.0
        for lvl in levels:
            level_notional = lvl.price * lvl.size
            take = min(level_notional, remaining)
            if take <= 0:
                break
            spent += take
            size += take / lvl.price
            remaining -= take
            if remaining <= 1e-9:
                break
        if remaining > 1e-9 or size == 0:
            return None
        return spent / size, size
