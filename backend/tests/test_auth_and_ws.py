from fastapi.testclient import TestClient
import pytest
from pathlib import Path

from app.auth.google_oauth import GoogleIdentity
from app.auth.session_service import SessionPrincipal
from app.cache.translation_cache import MemoryTranslationCache
from app.config import Settings, get_settings
from app.main import create_app
from app.observability.metrics import MetricsRegistry
from app.orchestration.message_orchestrator import ChatInboundMessage, MessageOrchestrator
from app.translation.adapters.mock import MockTranslationAdapter
from app.translation.router import TranslationRouter
from app.translation.service import TranslationService


class FakeGoogleOAuthClient:
    async def verify_token(self, credential: str) -> GoogleIdentity:
        if credential != "good-token":
            raise ValueError("bad token")
        return GoogleIdentity(sub="sub-123", email="user@example.com")


class FakeSocket:
    def __init__(self, socket_id: str) -> None:
        self.socket_id = socket_id


class FakeConnectionManager:
    def __init__(self) -> None:
        self.payloads: list[dict] = []
        self._rooms: dict[str, dict[str, tuple[FakeSocket, ...]]] = {}

    def set_room_targets(self, conversation_id: str, targets: dict[str, tuple[FakeSocket, ...]]) -> None:
        self._rooms[conversation_id] = targets

    def snapshot_target_groups(self, conversation_id: str) -> dict[str, tuple[FakeSocket, ...]]:
        return self._rooms.get(conversation_id, {})

    async def send(self, conversation_id: str, websockets, payload: dict) -> None:
        self.payloads.append(
            {
                **payload,
                "conversation_id": conversation_id,
                "targets": [websocket.socket_id for websocket in websockets],
            }
        )


class FakeMessageRepository:
    def __init__(self) -> None:
        self.envelopes: list[dict] = []
        self.translations: list[dict] = []

    async def save_envelope(self, **kwargs) -> int:
        self.envelopes.append(kwargs)
        return 1

    async def save_translation(self, message_id: int, record) -> None:
        self.translations.append({"message_id": message_id, "record": record})


def build_client() -> TestClient:
    get_settings.cache_clear()
    app = create_app()
    app.state.google_oauth_client = FakeGoogleOAuthClient()
    return TestClient(app)


@pytest.fixture(autouse=True)
def clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_google_login_issues_session_cookie():
    with build_client() as client:
        response = client.post("/api/auth/google", json={"credential": "good-token"})
        assert response.status_code == 200
        body = response.json()
        assert "token" not in body
        assert body["user"]["auth_provider"] == "google"
        assert body["user"]["google_sub"] == "sub-123"
        assert response.cookies.get("talk_session")


def test_guest_login_issues_session_cookie():
    with build_client() as client:
        response = client.post("/api/auth/guest", json={"display_name": "Guest User"})
        assert response.status_code == 200
        body = response.json()
        assert "token" not in body
        assert body["user"]["auth_provider"] == "guest"
        assert body["user"]["display_name"] == "Guest User"
        assert body["user"]["google_sub"] is None
        assert response.cookies.get("talk_session")


def test_app_serves_built_frontend_when_dist_exists(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    dist_dir = tmp_path / "web-dist"
    dist_dir.mkdir()
    (dist_dir / "index.html").write_text("<!doctype html><html><body>talk web</body></html>", encoding="utf-8")
    assets_dir = dist_dir / "assets"
    assets_dir.mkdir()
    (assets_dir / "app.js").write_text("console.log('talk');", encoding="utf-8")
    monkeypatch.setenv("WEB_DIST_DIR", str(dist_dir))

    with build_client() as client:
        index_response = client.get("/")
        asset_response = client.get("/assets/app.js")

    assert index_response.status_code == 200
    assert "talk web" in index_response.text
    assert asset_response.status_code == 200
    assert "console.log('talk');" in asset_response.text


@pytest.mark.asyncio
async def test_orchestrator_translates_per_target_language_and_records_metrics():
    connection_manager = FakeConnectionManager()
    connection_manager.set_room_targets(
        "room-1",
        {
            "en": (FakeSocket("client-en"),),
            "ko": (FakeSocket("client-ko"),),
        },
    )
    repository = FakeMessageRepository()
    metrics = MetricsRegistry()
    translation_service = TranslationService(
        settings=Settings(),
        router=TranslationRouter(
            [MockTranslationAdapter()],
            default_provider="mock",
        ),
        cache=MemoryTranslationCache(),
        metrics=metrics,
    )
    orchestrator = MessageOrchestrator(connection_manager, translation_service, repository, metrics)
    principal = SessionPrincipal(
        session_id="s1",
        user_id="u1",
        auth_provider="google",
        display_name="user@example.com",
        google_sub="sub-123",
        email="user@example.com",
        expires_at=9999999999,
    )

    await orchestrator.handle_message(
        "room-1",
        principal,
        ChatInboundMessage(client_msg_id="m1", text="hello", source_lang="en"),
    )

    assert [payload["t"] for payload in connection_manager.payloads] == [
        "msg_start",
        "msg_start",
        "msg_delta",
        "msg_delta",
        "msg_final",
        "msg_delta",
        "msg_delta",
        "msg_final",
    ]
    assert connection_manager.payloads[0]["targets"] == ["client-en"]
    assert connection_manager.payloads[0]["dst"] == "en"
    assert connection_manager.payloads[1]["targets"] == ["client-ko"]
    assert connection_manager.payloads[1]["dst"] == "ko"
    assert connection_manager.payloads[4]["text"] == "[en] hello"
    assert connection_manager.payloads[4]["targets"] == ["client-en"]
    assert connection_manager.payloads[4]["provider"] == "mock"
    assert connection_manager.payloads[-1]["text"] == "[ko] hello"
    assert connection_manager.payloads[-1]["targets"] == ["client-ko"]
    assert repository.envelopes[0]["client_msg_id"] == "m1"
    assert [entry["record"].target_lang for entry in repository.translations] == ["en", "ko"]
    assert [entry["record"].translated_text for entry in repository.translations] == [
        "[en] hello",
        "[ko] hello",
    ]
    assert metrics.timings["original_delivery_ms"]
    assert metrics.timings["translation_full_ms"]
