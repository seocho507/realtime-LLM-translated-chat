from app.auth.session_service import SessionService


def test_session_service_issues_and_verifies_token():
    service = SessionService(secret="test-secret", ttl_seconds=300)
    token, principal = service.issue("google-sub-1", "user@example.com")
    verified = service.verify(token)
    assert verified is not None
    assert verified.user_id == principal.user_id
    assert verified.google_sub == "google-sub-1"
