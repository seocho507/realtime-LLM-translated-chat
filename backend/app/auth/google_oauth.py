from __future__ import annotations

from dataclasses import dataclass

import httpx


@dataclass(slots=True)
class GoogleIdentity:
    sub: str
    email: str
    name: str | None = None
    picture: str | None = None


class GoogleOAuthClient:
    async def verify_token(self, credential: str) -> GoogleIdentity:
        raise NotImplementedError


class HttpGoogleOAuthClient(GoogleOAuthClient):
    def __init__(self, client_id: str = "", allowed_domain: str = "") -> None:
        self._client_id = client_id
        self._allowed_domain = allowed_domain

    async def verify_token(self, credential: str) -> GoogleIdentity:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": credential},
            )
            response.raise_for_status()
            payload = response.json()

        audience = payload.get("aud")
        if self._client_id and audience != self._client_id:
            raise ValueError("google audience mismatch")

        hosted_domain = payload.get("hd")
        if self._allowed_domain and hosted_domain != self._allowed_domain:
            raise ValueError("google hosted domain mismatch")

        email = payload.get("email")
        sub = payload.get("sub")
        if not email or not sub:
            raise ValueError("google token missing required claims")

        return GoogleIdentity(
            sub=sub,
            email=email,
            name=payload.get("name"),
            picture=payload.get("picture"),
        )
