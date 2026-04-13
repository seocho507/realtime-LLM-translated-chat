from app.auth.session_service import SessionService


def test_session_service_issues_and_verifies_token():
    service = SessionService(secret="test-secret", ttl_seconds=300)
    token, principal = service.issue("google-sub-1", "user@example.com")
    verified = service.verify(token)
    assert verified is not None
    assert verified.user_id == principal.user_id
    assert verified.auth_provider == "google"
    assert verified.display_name == "user@example.com"
    assert verified.google_sub == "google-sub-1"


def test_session_service_issues_guest_token():
    service = SessionService(secret="test-secret", ttl_seconds=300)
    token, principal = service.issue_guest("Guest User")
    verified = service.verify(token)
    assert verified is not None
    assert verified.user_id == principal.user_id
    assert verified.auth_provider == "guest"
    assert verified.display_name == "Guest User"
    assert verified.google_sub is None
    assert verified.email is None
