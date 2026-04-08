from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


class Database:
    def __init__(self, url: str) -> None:
        self.engine = create_async_engine(url, future=True)
        self.session_factory = async_sessionmaker(self.engine, expire_on_commit=False, class_=AsyncSession)

    async def init_models(self, base_metadata) -> None:
        async with self.engine.begin() as connection:
            await connection.run_sync(base_metadata.create_all)
