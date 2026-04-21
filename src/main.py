import logging
import sys
import time

from .captions import CaptionGenerator
from .config import Config
from .content_queue import ContentQueue
from .facebook import FacebookClient, FacebookError
from .highlevel import HighLevelClient
from .instagram import InstagramClient, InstagramError

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("poster")


def _resolve_caption(item, captioner: CaptionGenerator) -> str:
    if item.caption.strip():
        return item.caption
    if not captioner.enabled:
        return ""
    log.info("Caption blank; asking Claude to generate one...")
    generated = captioner.generate(item.media_url, item.media_type, item.hint)
    if generated:
        log.info("Caption generated (%d chars).", len(generated))
        return generated
    log.warning("Caption generation returned nothing; posting with empty caption.")
    return ""


def post_once(
    cfg: Config,
    ig: InstagramClient,
    fb: FacebookClient | None,
    hl: HighLevelClient,
    captioner: CaptionGenerator,
    queue: ContentQueue,
) -> bool:
    nxt = queue.next_unposted()
    if nxt is None:
        log.info("Queue is empty - nothing to post.")
        return False

    index, item = nxt
    caption = _resolve_caption(item, captioner)

    log.info("Posting queue item %d (%s): %s", index, item.media_type, item.media_url)
    try:
        media_id = ig.publish(item.media_url, item.media_type, caption)
    except InstagramError as e:
        log.error("Instagram publish failed: %s", e)
        return False

    log.info("Published to Instagram media_id=%s", media_id)
    queue.mark_posted(index, media_id)

    if fb is not None:
        try:
            fb_id = fb.publish(item.media_url, item.media_type, caption)
            log.info("Cross-posted to Facebook Page post_id=%s", fb_id)
        except FacebookError as e:
            log.warning("Facebook cross-post failed (non-fatal): %s", e)

    hl.notify_post(media_id, item.media_url, item.media_type, caption)
    return True


def _build_services(cfg: Config):
    ig = InstagramClient(cfg.ig_access_token, cfg.ig_user_id, cfg.ig_graph_version)
    fb = None
    if cfg.crosspost_to_facebook and cfg.fb_page_id:
        fb = FacebookClient(cfg.ig_access_token, cfg.fb_page_id, cfg.ig_graph_version)
    hl = HighLevelClient(
        cfg.highlevel_webhook_url,
        cfg.highlevel_api_token,
        cfg.highlevel_location_id,
    )
    captioner = CaptionGenerator(cfg.anthropic_api_key, cfg.business_name)
    return ig, fb, hl, captioner


def run_forever(cfg: Config) -> None:
    ig, fb, hl, captioner = _build_services(cfg)
    queue = ContentQueue()
    interval_s = int(cfg.post_interval_hours * 3600)

    log.info(
        "Starting scheduler: every %.1fh | FB=%s | HL=%s | AI captions=%s",
        cfg.post_interval_hours,
        "on" if fb else "off",
        "on" if hl.enabled else "off",
        "on" if captioner.enabled else "off",
    )
    while True:
        post_once(cfg, ig, fb, hl, captioner, queue)
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
        ig, fb, hl, captioner = _build_services(cfg)
        posted = post_once(cfg, ig, fb, hl, captioner, ContentQueue())
        return 0 if posted else 1

    try:
        run_forever(cfg)
    except KeyboardInterrupt:
        log.info("Stopped by user.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
