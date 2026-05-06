"""Runtime configuration loaded from environment / .env."""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import List

from dotenv import load_dotenv

load_dotenv()


def _req(name: str) -> str:
    val = os.environ.get(name)
    if not val:
        raise RuntimeError(f"Missing required env var: {name}")
    return val


def _float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    return float(raw) if raw not in (None, "") else default


def _int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    return int(raw) if raw not in (None, "") else default


def _token_ids() -> List[str]:
    raw = os.environ.get("TOKEN_IDS", "")
    return [t.strip() for t in raw.split(",") if t.strip()]


@dataclass(frozen=True)
class Config:
    pk: str
    funder: str
    clob_host: str
    ws_host: str
    chain_id: int
    token_ids: List[str]

    order_size_usdc: float
    quote_spread_bps: float
    max_slippage_bps: float
    requote_interval_sec: float
    inventory_cap_usdc: float
    min_tick_size: float
    log_level: str


def load() -> Config:
    token_ids = _token_ids()
    if not token_ids:
        raise RuntimeError("TOKEN_IDS must list at least one CLOB token_id")
    return Config(
        pk=_req("PK"),
        funder=_req("FUNDER"),
        clob_host=os.environ.get("CLOB_HOST", "https://clob.polymarket.com"),
        ws_host=os.environ.get(
            "WS_HOST", "wss://ws-subscriptions-clob.polymarket.com/ws/market"
        ),
        chain_id=_int("CHAIN_ID", 137),
        token_ids=token_ids,
        order_size_usdc=_float("ORDER_SIZE_USDC", 20.0),
        quote_spread_bps=_float("QUOTE_SPREAD_BPS", 80.0),
        max_slippage_bps=_float("MAX_SLIPPAGE_BPS", 100.0),
        requote_interval_sec=_float("REQUOTE_INTERVAL_SEC", 2.0),
        inventory_cap_usdc=_float("INVENTORY_CAP_USDC", 200.0),
        min_tick_size=_float("MIN_TICK_SIZE", 0.01),
        log_level=os.environ.get("LOG_LEVEL", "INFO"),
    )
