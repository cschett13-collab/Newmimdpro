import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


def _required(name: str) -> str:
    val = os.getenv(name, "").strip()
    if not val:
        raise RuntimeError(f"Missing required env var: {name}")
    return val


def _bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name, "").strip().lower()
    if not raw:
        return default
    return raw in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Config:
    ig_access_token: str
    ig_user_id: str
    ig_graph_version: str
    fb_page_id: str
    crosspost_to_facebook: bool
    highlevel_webhook_url: str
    highlevel_api_token: str
    highlevel_location_id: str
    anthropic_api_key: str
    business_name: str
    post_interval_hours: float

    @classmethod
    def load(cls) -> "Config":
        return cls(
            ig_access_token=_required("IG_ACCESS_TOKEN"),
            ig_user_id=_required("IG_USER_ID"),
            ig_graph_version=os.getenv("IG_GRAPH_VERSION", "v21.0").strip(),
            fb_page_id=os.getenv("FB_PAGE_ID", "").strip(),
            crosspost_to_facebook=_bool("CROSSPOST_TO_FACEBOOK", False),
            highlevel_webhook_url=os.getenv("HIGHLEVEL_WEBHOOK_URL", "").strip(),
            highlevel_api_token=os.getenv("HIGHLEVEL_API_TOKEN", "").strip(),
            highlevel_location_id=os.getenv("HIGHLEVEL_LOCATION_ID", "").strip(),
            anthropic_api_key=os.getenv("ANTHROPIC_API_KEY", "").strip(),
            business_name=os.getenv("BUSINESS_NAME", "Fox Valley Client Engine").strip(),
            post_interval_hours=float(os.getenv("POST_INTERVAL_HOURS", "5")),
        )
