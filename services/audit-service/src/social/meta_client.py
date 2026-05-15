import httpx
from typing import Optional


class MetaClient:
    """Client for Meta Graph API (Instagram + Facebook)."""

    BASE_URL = "https://graph.facebook.com/v20.0"

    def __init__(self, access_token: str):
        self.access_token = access_token
        self.client = httpx.AsyncClient(timeout=30.0)

    async def get_profile(self, user_id: str) -> dict:
        res = await self.client.get(
            f"{self.BASE_URL}/{user_id}",
            params={
                "fields": "name,biography,followers_count,media_count,profile_picture_url,website",
                "access_token": self.access_token,
            },
        )
        res.raise_for_status()
        return res.json()

    async def get_recent_posts(self, user_id: str, limit: int = 25) -> list:
        res = await self.client.get(
            f"{self.BASE_URL}/{user_id}/media",
            params={
                "fields": "id,caption,media_type,timestamp,like_count,comments_count,permalink",
                "limit": limit,
                "access_token": self.access_token,
            },
        )
        res.raise_for_status()
        return res.json().get("data", [])

    async def get_insights(self, media_id: str) -> dict:
        res = await self.client.get(
            f"{self.BASE_URL}/{media_id}/insights",
            params={
                "metric": "impressions,reach,engagement,saved",
                "access_token": self.access_token,
            },
        )
        res.raise_for_status()
        return res.json()

    async def close(self):
        await self.client.aclose()
