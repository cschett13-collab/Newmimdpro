"""Pre-trade risk checks shared across strategies."""
from __future__ import annotations

import logging
from dataclasses import dataclass

from .orderbook import OrderBook

log = logging.getLogger(__name__)


@dataclass
class SlippageGuard:
    """Reject a take that would pay more than `max_bps` over the reference mid."""

    max_bps: float

    def check_take(
        self,
        book: OrderBook,
        side: str,
        notional_usdc: float,
    ) -> bool:
        ref = book.mid()
        if ref is None or ref <= 0:
            return False
        est = book.expected_fill_price(side, notional_usdc)
        if est is None:
            log.debug("[%s] book too thin for %.2f USDC", book.token_id, notional_usdc)
            return False
        vwap, _ = est
        if side.upper() == "BUY":
            slip_bps = (vwap - ref) / ref * 10_000
        else:
            slip_bps = (ref - vwap) / ref * 10_000
        ok = slip_bps <= self.max_bps
        if not ok:
            log.info(
                "[%s] slippage %.1f bps exceeds cap %.1f bps — skipping",
                book.token_id,
                slip_bps,
                self.max_bps,
            )
        return ok


@dataclass
class InventoryGuard:
    """Cap absolute inventory in USDC terms per token."""

    cap_usdc: float

    def can_increase(self, current_usdc: float, side: str, add_usdc: float) -> bool:
        delta = add_usdc if side.upper() == "BUY" else -add_usdc
        projected = current_usdc + delta
        return abs(projected) <= self.cap_usdc
