"""Entry point for the Polymarket market-making bot."""
from __future__ import annotations

import asyncio
import logging
import signal

from . import config
from .clob import Clob
from .market_maker import MarketMaker
from .ws_client import MarketStream


async def _amain() -> None:
    cfg = config.load()
    logging.basicConfig(
        level=cfg.log_level,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    log = logging.getLogger("bot")

    clob = Clob(
        host=cfg.clob_host,
        chain_id=cfg.chain_id,
        private_key=cfg.pk,
        funder=cfg.funder,
    )
    mm = MarketMaker(cfg, clob)
    stream = MarketStream(
        ws_host=cfg.ws_host,
        token_ids=cfg.token_ids,
        on_update=mm.on_book_update,
        default_tick=cfg.min_tick_size,
    )

    loop = asyncio.get_running_loop()
    stop = asyncio.Event()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop.set)

    runner = asyncio.create_task(stream.run())
    try:
        await stop.wait()
    finally:
        log.info("shutting down…")
        stream.stop()
        await mm.shutdown()
        runner.cancel()
        try:
            await runner
        except asyncio.CancelledError:
            pass


def main() -> None:
    asyncio.run(_amain())


if __name__ == "__main__":
    main()
