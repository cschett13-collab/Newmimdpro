import logging
import requests

log = logging.getLogger(__name__)


class FacebookError(RuntimeError):
    pass


class FacebookClient:
    """
    Cross-post the same media to a Facebook Page using the Page access token
    you already generated for Instagram. Uses:
      - POST /{page-id}/photos  for images
      - POST /{page-id}/videos  for videos
    """

    def __init__(self, access_token: str, page_id: str, graph_version: str = "v21.0"):
        self.access_token = access_token
        self.page_id = page_id
        self.base = f"https://graph.facebook.com/{graph_version}"

    def publish(self, media_url: str, media_type: str, caption: str) -> str:
        if media_type == "image":
            path = f"/{self.page_id}/photos"
            params = {"url": media_url, "caption": caption}
        elif media_type == "video":
            path = f"/{self.page_id}/videos"
            params = {"file_url": media_url, "description": caption}
        else:
            raise FacebookError(f"Unsupported media_type: {media_type}")

        params["access_token"] = self.access_token
        r = requests.post(f"{self.base}{path}", data=params, timeout=120)
        if not r.ok:
            raise FacebookError(f"POST {path} -> {r.status_code} {r.text}")
        data = r.json()
        post_id = data.get("id") or data.get("post_id")
        if not post_id:
            raise FacebookError(f"No post id in response: {data}")
        return post_id
