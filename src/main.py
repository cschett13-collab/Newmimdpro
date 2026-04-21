import logging
import sys
import time

from .config import Config
from .content_queue import ContentQueue
from .highlevel import HighLevelClient
from .instagram import InstagramClient, InstagramError

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("poster")


def post_once(cfg: Config, ig: InstagramClient, hl: HighLevelClient, queue: ContentQueue) -> bool:
    """Returns True if something was posted, False if the queue is empty."""
    nxt = queue.next_unposted()
    if nxt is None:
        log.info("Queue is empty - nothing to post.")
        return False

    index, item = nxt
    log.info("Posting queue item %d (%s): %s", index, item.media_type, item.media_url)
    try:
        media_id = ig.publish(item.media_url, item.media_type, item.caption)
    except InstagramError as e:
        log.error("Instagram publish failed: %s", e)
        return False

    log.info("Published media_id=%s", media_id)
    queue.mark_posted(index, media_id)
    hl.notify_post(media_id, item.media_url, item.media_type, item.caption)
    return True


def run_forever(cfg: Config) -> None:
    ig = InstagramClient(cfg.ig_access_token, cfg.ig_user_id, cfg.ig_graph_version)
    hl = HighLevelClient(
        cfg.highlevel_webhook_url,
        cfg.highlevel_api_token,
        cfg.highlevel_location_id,
    )
    queue = ContentQueue()
    interval_s = int(cfg.post_interval_hours * 3600)

    log.info(
        "Starting scheduler: every %.1fh, HighLevel %s",
        cfg.post_interval_hours,
        "ENABLED" if hl.enabled else "disabled",
    )
    while True:
        post_once(cfg, ig, hl, queue)
        log.info("Sleeping %ss until next post.", interval_s)
        time.sleep(interval_s)


def main() -> int:
    try:
        cfg = Config.load()
    except RuntimeError as e:
        log.error(str(e))
        log.error("Copy .env.example to .env and fill in the required values.")
        return 2

    if len(sys.argv) > 1 and sys.argv[1] == "once":
        ig = InstagramClient(cfg.ig_access_token, cfg.ig_user_id, cfg.ig_graph_version)
        hl = HighLevelClient(
            cfg.highlevel_webhook_url,
            cfg.highlevel_api_token,
            cfg.highlevel_location_id,
        )
        posted = post_once(cfg, ig, hl, ContentQueue())
        return 0 if posted else 1

    try:
        run_forever(cfg)
    except KeyboardInterrupt:
        log.info("Stopped by user.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
