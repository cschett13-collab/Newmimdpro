"""Thin wrapper around `py_clob_client` for the trading paths we use.

Keeps the SDK surface area small and centralizes the FOK / GTC distinction
so the strategy code does not need to know the order-type enum names.
"""
from __future__ import annotations

import logging
from typing import Optional

from py_clob_client.client import ClobClient
from py_clob_client.clob_types import (
    ApiCreds,
    OrderArgs,
    OrderType,
)
from py_clob_client.constants import POLYGON
from py_clob_client.order_builder.constants import BUY, SELL

log = logging.getLogger(__name__)


class Clob:
    def __init__(
        self,
        host: str,
        chain_id: int,
        private_key: str,
        funder: str,
    ) -> None:
        # signature_type=2 => Polymarket proxy / funder flow.
        self._client = ClobClient(
            host=host,
            chain_id=chain_id or POLYGON,
            key=private_key,
            funder=funder,
            signature_type=2,
        )
        creds = self._client.create_or_derive_api_creds()
        self._client.set_api_creds(creds)
        log.info("CLOB ready (funder=%s)", funder)

    @property
    def api_creds(self) -> ApiCreds:
        return self._client.creds

    # ---- queries ------------------------------------------------------

    def get_orderbook(self, token_id: str):
        return self._client.get_order_book(token_id)

    def get_tick_size(self, token_id: str) -> float:
        try:
            return float(self._client.get_tick_size(token_id))
        except Exception:  # pragma: no cover - defensive
            return 0.01

    # ---- orders -------------------------------------------------------

    def place_fok(self, token_id: str, side: str, price: float, size: float) -> dict:
        """Send a FOK order. Polymarket fills it fully or kills it."""
        args = OrderArgs(
            token_id=token_id,
            price=round(price, 4),
            size=round(size, 4),
            side=BUY if side.upper() == "BUY" else SELL,
        )
        signed = self._client.create_order(args)
        return self._client.post_order(signed, OrderType.FOK)

    def place_gtc(self, token_id: str, side: str, price: float, size: float) -> dict:
        args = OrderArgs(
            token_id=token_id,
            price=round(price, 4),
            size=round(size, 4),
            side=BUY if side.upper() == "BUY" else SELL,
        )
        signed = self._client.create_order(args)
        return self._client.post_order(signed, OrderType.GTC)

    def cancel(self, order_id: str) -> dict:
        return self._client.cancel(order_id=order_id)

    def cancel_all_for_market(self, token_id: str) -> Optional[dict]:
        try:
            return self._client.cancel_market_orders(asset_id=token_id)
        except Exception as exc:  # pragma: no cover - defensive
            log.warning("cancel_market_orders failed for %s: %s", token_id, exc)
            return None
