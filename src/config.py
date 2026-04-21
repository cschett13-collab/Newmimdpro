import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


def _required(name: str) -> str:
    val = os.getenv(name, "").strip()
    if not val:
        raise RuntimeError(f"Missing required env var: {name}")
    return val


@dataclass(frozen=True)
class Config:
    ig_access_token: str
    ig_user_id: str
    ig_graph_version: str
    highlevel_webhook_url: str
    highlevel_api_token: str
    highlevel_location_id: str
    post_interval_hours: float

    @classmethod
    def load(cls) -> "Config":
        return cls(
            ig_access_token=_required("IG_ACCESS_TOKEN"),
            ig_user_id=_required("IG_USER_ID"),
            ig_graph_version=os.getenv("IG_GRAPH_VERSION", "v21.0").strip(),
            highlevel_webhook_url=os.getenv("HIGHLEVEL_WEBHOOK_URL", "").strip(),
            highlevel_api_token=os.getenv("HIGHLEVEL_API_TOKEN", "").strip(),
            highlevel_location_id=os.getenv("HIGHLEVEL_LOCATION_ID", "").strip(),
            post_interval_hours=float(os.getenv("POST_INTERVAL_HOURS", "5")),
        )
