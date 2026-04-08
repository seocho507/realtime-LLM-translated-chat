from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Message(Base):
    __tablename__ = 'messages'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    conversation_id: Mapped[str] = mapped_column(String(128), index=True)
    sender_id: Mapped[str] = mapped_column(String(128), index=True)
    client_msg_id: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    original_text: Mapped[str] = mapped_column(Text)
    original_lang: Mapped[str] = mapped_column(String(16), default='auto')
    status: Mapped[str] = mapped_column(String(32), default='translating')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class MessageTranslation(Base):
    __tablename__ = 'message_translations'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    message_id: Mapped[int] = mapped_column(ForeignKey('messages.id'), index=True)
    target_lang: Mapped[str] = mapped_column(String(16))
    translated_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    provider: Mapped[str | None] = mapped_column(String(64), nullable=True)
    model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    prompt_version: Mapped[str] = mapped_column(String(32), default='v1')
    cached: Mapped[bool] = mapped_column(Boolean, default=False)
    latency_first_token_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    latency_total_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
