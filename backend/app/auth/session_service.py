from __future__ import annotations

from base64 import urlsafe_b64decode, urlsafe_b64encode
from dataclasses import asdict, dataclass
from hashlib import sha256
from hmac import compare_digest, new as hmac_new
import json
import secrets
import time


@dataclass(slots=True)
class SessionPrincipal:
    session_id: str
    user_id: str
    auth_provider: str
    display_name: str
    google_sub: str | None
    email: str | None
    expires_at: int


class SessionService:
    def __init__(self, secret: str, ttl_seconds: int = 60 * 60 * 12) -> None:
        self._secret = secret.encode("utf-8")
        self._ttl_seconds = ttl_seconds

    def issue(self, google_sub: str, email: str) -> tuple[str, SessionPrincipal]:
        return self.issue_google(google_sub, email)

    def issue_google(self, google_sub: str, email: str) -> tuple[str, SessionPrincipal]:
        now = int(time.time())
        principal = SessionPrincipal(
            session_id=secrets.token_urlsafe(16),
            user_id=sha256(google_sub.encode("utf-8")).hexdigest()[:16],
            auth_provider="google",
            display_name=email,
            google_sub=google_sub,
            email=email,
            expires_at=now + self._ttl_seconds,
        )
        return self._encode(principal)

    def issue_local(self, user_id: str, email: str, display_name: str) -> tuple[str, SessionPrincipal]:
        now = int(time.time())
        principal = SessionPrincipal(
            session_id=secrets.token_urlsafe(16),
            user_id=user_id,
            auth_provider="local",
            display_name=display_name,
            google_sub=None,
            email=email,
            expires_at=now + self._ttl_seconds,
        )
        return self._encode(principal)

    def issue_guest(self, display_name: str | None = None) -> tuple[str, SessionPrincipal]:
        now = int(time.time())
        guest_id = f"guest:{secrets.token_urlsafe(16)}"
        principal = SessionPrincipal(
            session_id=secrets.token_urlsafe(16),
            user_id=sha256(guest_id.encode("utf-8")).hexdigest()[:16],
            auth_provider="guest",
            display_name=display_name.strip() if display_name and display_name.strip() else f"Guest {secrets.token_hex(2).upper()}",
            google_sub=None,
            email=None,
            expires_at=now + self._ttl_seconds,
        )
        return self._encode(principal)

    def _encode(self, principal: SessionPrincipal) -> tuple[str, SessionPrincipal]:
        payload = urlsafe_b64encode(json.dumps(asdict(principal), separators=(",", ":")).encode("utf-8")).decode("utf-8")
        signature = urlsafe_b64encode(hmac_new(self._secret, payload.encode("utf-8"), sha256).digest()).decode("utf-8")
        return f"{payload}.{signature}", principal

    def verify(self, token: str) -> SessionPrincipal | None:
        try:
            payload, signature = token.split(".", 1)
            expected = urlsafe_b64encode(hmac_new(self._secret, payload.encode("utf-8"), sha256).digest()).decode("utf-8")
            if not compare_digest(signature, expected):
                return None
            data = json.loads(urlsafe_b64decode(payload.encode("utf-8")).decode("utf-8"))
            principal = SessionPrincipal(**data)
            if principal.expires_at < int(time.time()):
                return None
            return principal
        except Exception:
            return None
