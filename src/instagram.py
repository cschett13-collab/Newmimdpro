import time
import logging
import requests

log = logging.getLogger(__name__)


class InstagramError(RuntimeError):
    pass


class InstagramClient:
    """
    Thin wrapper around Instagram Graph API for publishing a single
    image or video to a connected Instagram Business account.

    Flow:
      1. POST /{ig-user-id}/media  -> creation_id (a.k.a. container)
      2. For video: poll /{creation_id}?fields=status_code until FINISHED
      3. POST /{ig-user-id}/media_publish with creation_id
    """

    def __init__(self, access_token: str, ig_user_id: str, graph_version: str = "v21.0"):
        self.access_token = access_token
        self.ig_user_id = ig_user_id
        self.base = f"https://graph.facebook.com/{graph_version}"

    def _post(self, path: str, params: dict) -> dict:
        params = {**params, "access_token": self.access_token}
        r = requests.post(f"{self.base}{path}", data=params, timeout=60)
        if not r.ok:
            raise InstagramError(f"POST {path} -> {r.status_code} {r.text}")
        return r.json()

    def _get(self, path: str, params: dict | None = None) -> dict:
        params = {**(params or {}), "access_token": self.access_token}
        r = requests.get(f"{self.base}{path}", params=params, timeout=60)
        if not r.ok:
            raise InstagramError(f"GET {path} -> {r.status_code} {r.text}")
        return r.json()

    def _create_container(self, media_url: str, media_type: str, caption: str) -> str:
        params = {"caption": caption}
        if media_type == "image":
            params["image_url"] = media_url
        elif media_type == "video":
            params["media_type"] = "REELS"
            params["video_url"] = media_url
        else:
            raise InstagramError(f"Unsupported media_type: {media_type}")

        result = self._post(f"/{self.ig_user_id}/media", params)
        creation_id = result.get("id")
        if not creation_id:
            raise InstagramError(f"No creation id in response: {result}")
        return creation_id

    def _wait_for_container(self, creation_id: str, timeout_s: int = 300) -> None:
        deadline = time.time() + timeout_s
        while time.time() < deadline:
            status = self._get(f"/{creation_id}", {"fields": "status_code"})
            code = status.get("status_code")
            if code == "FINISHED":
                return
            if code in {"ERROR", "EXPIRED"}:
                raise InstagramError(f"Container {creation_id} failed: {status}")
            log.info("Container %s not ready (%s), waiting...", creation_id, code)
            time.sleep(10)
        raise InstagramError(f"Container {creation_id} not ready within {timeout_s}s")

    def _publish(self, creation_id: str) -> str:
        result = self._post(
            f"/{self.ig_user_id}/media_publish",
            {"creation_id": creation_id},
        )
        media_id = result.get("id")
        if not media_id:
            raise InstagramError(f"No media id in publish response: {result}")
        return media_id

    def publish(self, media_url: str, media_type: str, caption: str) -> str:
        """Create, (optionally wait), and publish. Returns published media id."""
        creation_id = self._create_container(media_url, media_type, caption)
        if media_type == "video":
            self._wait_for_container(creation_id)
        return self._publish(creation_id)
