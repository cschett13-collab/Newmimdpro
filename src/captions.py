import logging
import os

log = logging.getLogger(__name__)

DEFAULT_SYSTEM = (
    "You write short, high-engagement Instagram captions for a small-business "
    "account. Voice: confident, friendly, zero corporate fluff. "
    "Length: 1-3 sentences plus 5-10 hyper-relevant hashtags on a new line. "
    "Never invent facts about the business; stay visual."
)


class CaptionGenerator:
    """
    Optional. If ANTHROPIC_API_KEY is set, uses Claude's vision to turn an
    image URL (and/or a short hint) into a caption. No-ops gracefully if the
    SDK or key is missing so the poster keeps running either way.
    """

    def __init__(self, api_key: str, business_name: str = "", model: str = "claude-sonnet-4-6"):
        self.api_key = api_key
        self.business_name = business_name
        self.model = model
        self._client = None

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    def _get_client(self):
        if self._client is not None:
            return self._client
        try:
            from anthropic import Anthropic
        except ImportError:
            log.warning("anthropic SDK not installed; skipping caption generation.")
            return None
        self._client = Anthropic(api_key=self.api_key)
        return self._client

    def generate(self, media_url: str, media_type: str, hint: str = "") -> str | None:
        if not self.enabled:
            return None
        client = self._get_client()
        if client is None:
            return None

        business_line = (
            f"Business: {self.business_name}. " if self.business_name else ""
        )
        user_parts: list[dict] = []
        if media_type == "image":
            user_parts.append(
                {"type": "image", "source": {"type": "url", "url": media_url}}
            )
        prompt_text = (
            f"{business_line}"
            f"Write an Instagram caption for this {media_type}."
        )
        if hint:
            prompt_text += f" Context hint: {hint}"
        user_parts.append({"type": "text", "text": prompt_text})

        try:
            msg = client.messages.create(
                model=self.model,
                max_tokens=400,
                system=DEFAULT_SYSTEM,
                messages=[{"role": "user", "content": user_parts}],
            )
        except Exception as e:
            log.warning("Caption generation failed (non-fatal): %s", e)
            return None

        text_chunks = [b.text for b in msg.content if getattr(b, "type", None) == "text"]
        caption = "\n".join(text_chunks).strip()
        return caption or None


def build_from_env(business_name: str = "") -> CaptionGenerator:
    return CaptionGenerator(
        api_key=os.getenv("ANTHROPIC_API_KEY", "").strip(),
        business_name=business_name,
    )
