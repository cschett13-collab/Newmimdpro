# Polymarket Market-Making Bot

A small Python bot that quotes both sides of one or more Polymarket CLOB
markets, listens for real-time order-book updates over WebSocket, and uses
fill-or-kill (FOK) orders to take obvious mispricings without partial fills.

## Design

```
              ┌──────────────────────────┐
              │  WS: clob market stream  │
              └────────────┬─────────────┘
                           │  book / price_change
                           ▼
                 ┌──────────────────┐
                 │  OrderBook (mem) │
                 └────────┬─────────┘
                          │
                          ▼
   ┌──────────────────────────────────────────┐
   │  MarketMaker                             │
   │   • requote bid/ask around mid (GTC)     │
   │   • opportunistic FOK take when crossed  │
   │   • SlippageGuard caps takes at 1%       │
   │   • InventoryGuard caps absolute USDC    │
   └──────────────────┬───────────────────────┘
                      │  REST
                      ▼
          ┌────────────────────────┐
          │   py-clob-client       │
          │   (Polymarket CLOB)    │
          └────────────────────────┘
```

Every component is wired around one event loop. The strategy never blocks
on REST calls inside the WS handler for longer than one round trip — if a
quote update is in flight the next book update is simply skipped (see the
per-token `lock`).

## Files

| File | What it does |
| ---- | ------------ |
| `config.py` | Loads `.env` into a frozen `Config` dataclass. |
| `orderbook.py` | In-memory order book + slippage estimator. |
| `ws_client.py` | Connects to `wss://ws-subscriptions-clob.polymarket.com/ws/market`, applies snapshots and diffs, calls back the strategy. |
| `clob.py` | Thin wrapper around `py_clob_client` exposing `place_fok`, `place_gtc`, `cancel`. |
| `risk.py` | `SlippageGuard` (1% cap) and `InventoryGuard`. |
| `market_maker.py` | The strategy: symmetric quoting + opportunistic FOK takes. |
| `main.py` | Entry point. |

## Setup

```bash
cd bot
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# fill in PK, FUNDER, TOKEN_IDS
```

Run:

```bash
python -m bot.main
```

`Ctrl-C` cancels resting orders and exits cleanly.

## Latency

The bot is designed to run on a VPS in **eu-west-1 (Dublin)** for low
round-trip time to the Polymarket gateway hosted in the same region. To
get the most out of it:

- Pin the process to a single CPU and disable CPU frequency scaling.
- Use a kernel >= 5.15 with BBR congestion control.
- Keep the venv on a tmpfs / SSD so cold imports don't dominate startup.
- Run inside the same AZ as the Polymarket edge if you can — every extra
  hop adds tens of milliseconds, which directly maps to adverse selection.

## Risk controls

| Control | Where | Purpose |
| ------- | ----- | ------- |
| `MAX_SLIPPAGE_BPS` | `risk.SlippageGuard` | Caps VWAP-vs-mid drift on FOK takes (default 100 bps = 1%). |
| `INVENTORY_CAP_USDC` | `risk.InventoryGuard` | Absolute inventory ceiling per token. |
| `QUOTE_SPREAD_BPS` | `market_maker` | Half-spread used when posting passive GTC quotes. |
| `REQUOTE_INTERVAL_SEC` | `market_maker` | Floor on re-quote frequency to avoid hammering the API. |
| FOK only on takes | `clob.place_fok` | Polymarket kills the order if it cannot fill in full — no partial fills. |
| Cancel on shutdown | `MarketMaker.shutdown` | Best-effort cancel of every resting order. |

## Disclaimer

Educational reference implementation. Trading prediction markets carries
real financial risk; verify the strategy in a paper account before
deploying capital, and check your local laws on prediction-market access.
