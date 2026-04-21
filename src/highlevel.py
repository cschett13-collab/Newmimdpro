import logging
import requests

log = logging.getLogger(__name__)


class HighLevelClient:
    """
    HighLevel (GoHighLevel / LeadConnector) integration.

    Two transports are supported; configure whichever you prefer in .env:

    1) Webhook (simplest) - HIGHLEVEL_WEBHOOK_URL
       A plain HTTPS POST of the post result. Wire this into a HighLevel
       Workflow with an "Inbound Webhook" trigger to log notes on a contact,
       send a notification, update a pipeline, etc.

    2) API (full) - HIGHLEVEL_API_TOKEN + HIGHLEVEL_LOCATION_ID
       Uses the LeadConnector API v2 base to create a contact note. The
       exact endpoint path for social-planner posting is not used here on
       purpose - endpoints change; verify against your HighLevel account's
       current API docs (https://highlevel.stoplight.io/) before enabling.
    """

    API_BASE = "https://services.leadconnector.com"
    API_VERSION = "2021-07-28"

    def __init__(
        self,
        webhook_url: str = "",
        api_token: str = "",
        location_id: str = "",
    ):
        self.webhook_url = webhook_url
        self.api_token = api_token
        self.location_id = location_id

    @property
    def enabled(self) -> bool:
        return bool(self.webhook_url or (self.api_token and self.location_id))

    def notify_post(
        self,
        media_id: str,
        media_url: str,
        media_type: str,
        caption: str,
    ) -> None:
        """Best-effort notification; never raises."""
        if not self.enabled:
            return
        payload = {
            "event": "instagram_post_published",
            "media_id": media_id,
            "media_url": media_url,
            "media_type": media_type,
            "caption": caption,
            "permalink": f"https://www.instagram.com/p/{media_id}/",
        }
        try:
            if self.webhook_url:
                self._send_webhook(payload)
            elif self.api_token and self.location_id:
                self._send_api_note(payload)
        except Exception as e:
            log.warning("HighLevel notify failed (non-fatal): %s", e)

    def _send_webhook(self, payload: dict) -> None:
        r = requests.post(self.webhook_url, json=payload, timeout=30)
        r.raise_for_status()

    def _send_api_note(self, payload: dict) -> None:
        # Creates a contact-less note-style record via a generic endpoint.
        # If you want this to attach to a specific contact or run the
        # Social Planner API instead, swap the path here after checking
        # https://highlevel.stoplight.io/ for the current schema.
        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Version": self.API_VERSION,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        body = {
            "locationId": self.location_id,
            "type": "note",
            "body": (
                f"Instagram post published.\n"
                f"media_id: {payload['media_id']}\n"
                f"type: {payload['media_type']}\n"
                f"caption: {payload['caption'][:500]}"
            ),
        }
        r = requests.post(
            f"{self.API_BASE}/activities/",
            headers=headers,
            json=body,
            timeout=30,
        )
        r.raise_for_status()
