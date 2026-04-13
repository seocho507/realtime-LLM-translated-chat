from __future__ import annotations

import secrets

from sqlalchemy import select

from app.persistence.models import LocalUser


class UserRepository:
    def __init__(self, session_factory) -> None:
        self._session_factory = session_factory

    async def get_by_email(self, email: str) -> LocalUser | None:
        async with self._session_factory() as session:
            result = await session.execute(select(LocalUser).where(LocalUser.email == email))
            return result.scalar_one_or_none()

    async def create_local_user(self, *, email: str, display_name: str, password_hash: str) -> LocalUser:
        async with self._session_factory() as session:
            user = LocalUser(
                user_id=secrets.token_hex(8),
                auth_provider='local',
                display_name=display_name,
                email=email,
                password_hash=password_hash,
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
            return user
