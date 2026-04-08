from fastapi.testclient import TestClient

from app.auth.google_oauth import GoogleIdentity
from app.main import create_app


class FakeGoogleOAuthClient:
    async def verify_token(self, credential: str) -> GoogleIdentity:
        if credential != "good-token":
            raise ValueError("bad token")
        return GoogleIdentity(sub="sub-123", email="user@example.com")


def build_client() -> TestClient:
    app = create_app()
    app.state.google_oauth_client = FakeGoogleOAuthClient()
    return TestClient(app)


def test_google_login_issues_session_cookie():
    with build_client() as client:
        response = client.post("/api/auth/google", json={"credential": "good-token"})
        assert response.status_code == 200
        body = response.json()
        assert body["user"]["google_sub"] == "sub-123"
        assert response.cookies.get("talk_session")


def test_websocket_streams_translation_and_persists_message():
    with build_client() as client:
        auth_response = client.post("/api/auth/google", json={"credential": "good-token"})
        token = auth_response.json()["token"]

        with client.websocket_connect(f"/ws/chat/room-1?token={token}") as socket_a:
            with client.websocket_connect(f"/ws/chat/room-1?token={token}") as socket_b:
                socket_a.send_json(
                    {
                        "type": "send_message",
                        "client_msg_id": "m1",
                        "text": "안녕하세요",
                        "source_lang": "ko",
                        "target_lang": "en",
                    }
                )
                payloads = [socket_b.receive_json(), socket_b.receive_json(), socket_b.receive_json(), socket_b.receive_json()]
                assert [payload["t"] for payload in payloads] == ["msg_start", "msg_delta", "msg_delta", "msg_final"]
                assert payloads[-1]["provider"] == "anthropic"
                assert payloads[-1]["text"].startswith("[en]")

        saved = client.app.state.message_repository
        message = client.app.state.loop.run_until_complete(saved.get_message_by_client_id("m1")) if hasattr(client.app.state, 'loop') else None
        if message is None:
            import anyio
            message = anyio.run(saved.get_message_by_client_id, "m1")
        assert message is not None
        assert message.status == "translated"

        metrics = client.get("/metrics").json()
        assert metrics["timings"]["original_delivery_ms"]
        assert metrics["timings"]["translation_full_ms"]
