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
    client = build_client()
    response = client.post("/api/auth/google", json={"credential": "good-token"})
    assert response.status_code == 200
    body = response.json()
    assert body["user"]["google_sub"] == "sub-123"
    assert response.cookies.get("talk_session")


def test_websocket_requires_valid_session_and_broadcasts_original_message():
    client = build_client()
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
            first = socket_a.receive_json()
            second = socket_b.receive_json()
            assert first["t"] == "msg_start"
            assert second["original"] == "안녕하세요"
            assert second["sender_email"] == "user@example.com"
