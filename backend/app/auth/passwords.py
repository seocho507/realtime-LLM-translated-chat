from __future__ import annotations

from base64 import urlsafe_b64decode, urlsafe_b64encode
from hashlib import scrypt
import hmac
import secrets


class PasswordService:
    def __init__(
        self,
        *,
        salt_bytes: int = 16,
        n: int = 2**14,
        r: int = 8,
        p: int = 1,
        dklen: int = 64,
    ) -> None:
        self._salt_bytes = salt_bytes
        self._n = n
        self._r = r
        self._p = p
        self._dklen = dklen

    def hash_password(self, password: str) -> str:
        salt = secrets.token_bytes(self._salt_bytes)
        digest = scrypt(
            password.encode('utf-8'),
            salt=salt,
            n=self._n,
            r=self._r,
            p=self._p,
            dklen=self._dklen,
        )
        return '$'.join(
            [
                'scrypt',
                str(self._n),
                str(self._r),
                str(self._p),
                urlsafe_b64encode(salt).decode('utf-8'),
                urlsafe_b64encode(digest).decode('utf-8'),
            ]
        )

    def verify_password(self, password: str, encoded: str) -> bool:
        try:
            algorithm, n, r, p, salt, expected = encoded.split('$', 5)
            if algorithm != 'scrypt':
                return False
            computed = scrypt(
                password.encode('utf-8'),
                salt=urlsafe_b64decode(salt.encode('utf-8')),
                n=int(n),
                r=int(r),
                p=int(p),
                dklen=len(urlsafe_b64decode(expected.encode('utf-8'))),
            )
            return hmac.compare_digest(
                computed,
                urlsafe_b64decode(expected.encode('utf-8')),
            )
        except Exception:
            return False
