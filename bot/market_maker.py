"""Symmetric two-sided market maker.

For each token, on every WS update we:

1. Compute the mid from the local book.
2. Quote a bid at  mid * (1 - spread) and an ask at mid * (1 + spread),
   rounded to the venue tick.
3. If our existing quote is more than half a tick away from the desired
   price we cancel and replace it. Quotes are placed as GTC.
4. When the top of book trades into us aggressively we use a FOK take
   to skim, but only if `SlippageGuard` says the expected fill is
   within the configured cap.

The module is intentionally simple — production strategies layer on
inventory skew, fee math, and adverse-selection avoidance on top of this.
"""
from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Dict, Optional

from .clob import Clob
from .config import Config
from .orderbook import OrderBook
from .risk import InventoryGuard, SlippageGuard

log = logging.getLogger(__name__)


@dataclass
class TokenState:
    bid_order_id: Optional[str] = None
    ask_order_id: Optional[str] = None
    bid_price: Optional[float] = None
    ask_price: Optional[float] = None
    inventory_usdc: float = 0.0
    last_quote_ts: float = 0.0
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


class MarketMaker:
    def __init__(self, cfg: Config, clob: Clob) -> None:
        self._cfg = cfg
        self._clob = clob
        self._state: Dict[str, TokenState] = {t: TokenState() for t in cfg.token_ids}
        self._slip = SlippageGuard(max_bps=cfg.max_slippage_bps)
        self._inv = InventoryGuard(cap_usdc=cfg.inventory_cap_usdc)

    # ----- WebSocket entrypoint --------------------------------------

    async def on_book_update(self, token_id: str, book: OrderBook) -> None:
        st = self._state.get(token_id)
        if st is None:
            return
        if st.lock.locked():
            return  # already re-quoting; skip this tick.
        async with st.lock:
            await self._maybe_requote(token_id, book, st)
            await self._maybe_take(token_id, book, st)

    # ----- core logic -------------------------------------------------

    async def _maybe_requote(
        self, token_id: str, book: OrderBook, st: TokenState
    ) -> None:
        now = time.time()
        if now - st.last_quote_ts < self._cfg.requote_interval_sec:
            return
        mid = book.mid()
        if mid is None:
            return

        spread = self._cfg.quote_spread_bps / 10_000.0
        tick = book.tick_size or self._cfg.min_tick_size

        bid = self._round_to_tick(mid * (1 - spread), tick, floor=True)
        ask = self._round_to_tick(mid * (1 + spread), tick, floor=False)
        # Stay strictly inside [tick, 1-tick] — outcome tokens trade in [0,1].
        bid = max(bid, tick)
        ask = min(ask, 1.0 - tick)
        if bid >= ask:
            return

        size = self._cfg.order_size_usdc / mid

        await self._replace(token_id, st, "BUY", bid, size, tick)
        await self._replace(token_id, st, "SELL", ask, size, tick)
        st.last_quote_ts = now

    async def _replace(
        self,
        token_id: str,
        st: TokenState,
        side: str,
        price: float,
        size: float,
        tick: float,
    ) -> None:
        existing_id = st.bid_order_id if side == "BUY" else st.ask_order_id
        existing_px = st.bid_price if side == "BUY" else st.ask_price

        if existing_id and existing_px is not None and abs(existing_px - price) < tick / 2:
            return  # current quote is still good enough.

        if existing_id:
            try:
                self._clob.cancel(existing_id)
            except Exception as exc:
                log.warning("[%s] cancel %s failed: %s", token_id, existing_id, exc)

        if not self._inv.can_increase(st.inventory_usdc, side, price * size):
            log.debug("[%s] %s blocked by inventory cap", token_id, side)
            self._set_quote(st, side, None, None)
            return

        try:
            resp = self._clob.place_gtc(token_id, side, price, size)
        except Exception as exc:
            log.warning("[%s] place_gtc %s @ %.4f failed: %s", token_id, side, price, exc)
            self._set_quote(st, side, None, None)
            return

        oid = resp.get("orderID") or resp.get("order_id") or resp.get("id")
        self._set_quote(st, side, oid, price)
        log.info("[%s] quote %s %.4f x %.2f -> %s", token_id, side, price, size, oid)

    async def _maybe_take(
        self, token_id: str, book: OrderBook, st: TokenState
    ) -> None:
        """Opportunistic FOK take when the opposing side crosses our model price.

        Only fires if `SlippageGuard` clears the trade — this is what enforces
        the 1% slippage cap on aggressive flow.
        """
        mid = book.mid()
        if mid is None:
            return
        edge = self._cfg.quote_spread_bps / 10_000.0

        best_bid = book.best_bid()
        best_ask = book.best_ask()
        notional = self._cfg.order_size_usdc

        # Mispriced ask we can lift.
        if best_ask and best_ask.price < mid * (1 - edge):
            if self._slip.check_take(book, "BUY", notional) and self._inv.can_increase(
                st.inventory_usdc, "BUY", notional
            ):
                size = notional / best_ask.price
                self._safe_fok(token_id, st, "BUY", best_ask.price, size)

        # Mispriced bid we can hit.
        if best_bid and best_bid.price > mid * (1 + edge):
            if self._slip.check_take(book, "SELL", notional) and self._inv.can_increase(
                st.inventory_usdc, "SELL", notional
            ):
                size = notional / best_bid.price
                self._safe_fok(token_id, st, "SELL", best_bid.price, size)

    def _safe_fok(
        self, token_id: str, st: TokenState, side: str, price: float, size: float
    ) -> None:
        try:
            resp = self._clob.place_fok(token_id, side, price, size)
        except Exception as exc:
            log.warning("[%s] FOK %s failed: %s", token_id, side, exc)
            return
        if resp.get("status") == "matched" or resp.get("success"):
            delta = price * size
            st.inventory_usdc += delta if side == "BUY" else -delta
            log.info(
                "[%s] FOK %s @ %.4f x %.2f filled (inv=%.2f USDC)",
                token_id, side, price, size, st.inventory_usdc,
            )
        else:
            log.debug("[%s] FOK %s killed: %s", token_id, side, resp)

    # ----- helpers ----------------------------------------------------

    @staticmethod
    def _round_to_tick(price: float, tick: float, *, floor: bool) -> float:
        if tick <= 0:
            return price
        n = price / tick
        rounded = int(n) if floor else int(n) + (0 if n == int(n) else 1)
        return round(rounded * tick, 4)

    @staticmethod
    def _set_quote(
        st: TokenState, side: str, order_id: Optional[str], price: Optional[float]
    ) -> None:
        if side == "BUY":
            st.bid_order_id, st.bid_price = order_id, price
        else:
            st.ask_order_id, st.ask_price = order_id, price

    async def shutdown(self) -> None:
        for tok, st in self._state.items():
            for oid in (st.bid_order_id, st.ask_order_id):
                if oid:
                    try:
                        self._clob.cancel(oid)
                    except Exception:
                        pass
            self._clob.cancel_all_for_market(tok)
