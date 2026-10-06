"""Email delivery (FR-04): dev-log fallback + real SMTP path (mocked)."""

from unittest.mock import patch

import pytest

from app import email as email_mod
from app.config import settings


def test_dev_mode_logs_not_send(monkeypatch):
    monkeypatch.setattr(settings, "email_enabled", False)
    with patch("app.email.smtplib.SMTP") as smtp:
        email_mod.send_magic_link("x@y.com", "http://link")
        smtp.assert_not_called()  # dev: no SMTP connection, just a log line


def test_smtp_send_builds_and_sends(monkeypatch):
    monkeypatch.setattr(settings, "email_enabled", True)
    monkeypatch.setattr(settings, "smtp_host", "smtp.test")
    monkeypatch.setattr(settings, "smtp_use_tls", False)
    monkeypatch.setattr(settings, "smtp_use_ssl", False)
    monkeypatch.setattr(settings, "smtp_user", "")

    with patch("app.email.smtplib.SMTP") as smtp_cls:
        server = smtp_cls.return_value.__enter__.return_value
        email_mod.send_magic_link("cand@mailbox.org", "http://localhost/auth?token=ABC123")

        server.send_message.assert_called_once()
        msg = server.send_message.call_args[0][0]
        assert msg["To"] == "cand@mailbox.org"
        assert msg["Subject"] == "Your AAAI sign-in link"
        assert "ABC123" in msg.as_string()  # the magic link is in the email


def test_demo_domains_are_never_emailed(monkeypatch):
    # .local / .test addresses can't receive mail — log instead of bouncing.
    monkeypatch.setattr(settings, "email_enabled", True)
    monkeypatch.setattr(settings, "smtp_host", "smtp.test")
    with patch("app.email.smtplib.SMTP") as smtp:
        email_mod.send_magic_link("candidate@demo.local", "http://link")
        email_mod.send_magic_link("someone@site.test", "http://link")
        smtp.assert_not_called()


def test_enabled_without_host_raises(monkeypatch):
    monkeypatch.setattr(settings, "email_enabled", True)
    monkeypatch.setattr(settings, "smtp_host", "")
    with pytest.raises(RuntimeError):
        email_mod.send_magic_link("x@y.com", "http://link")


def test_brevo_api_is_used_when_key_is_set(monkeypatch):
    """Hosts like Render's free plan block SMTP - the Brevo HTTPS API is used instead."""
    import json as _json

    from app import email as email_mod

    monkeypatch.setattr(email_mod.settings, "email_enabled", True)
    monkeypatch.setattr(email_mod.settings, "smtp_host", "smtp.gmail.com")
    monkeypatch.setattr(email_mod.settings, "brevo_api_key", "xkeysib-test")
    monkeypatch.setattr(email_mod.settings, "smtp_from", "AAAI <sender@gmail.com>")
    sent = {}

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def read(self):
            return b'{"messageId":"x"}'

    def fake_urlopen(request, timeout):
        sent["url"], sent["key"] = request.full_url, request.headers["Api-key"]
        sent["body"] = _json.loads(request.data)
        return FakeResponse()

    monkeypatch.setattr(email_mod.urllib.request, "urlopen", fake_urlopen)
    monkeypatch.setattr(email_mod.smtplib, "SMTP", lambda *a, **k: (_ for _ in ()).throw(AssertionError("SMTP used")))

    email_mod.send_magic_link("person@gmail.com", "https://app/auth/callback?token=abc")
    assert sent["url"] == email_mod.BREVO_URL and sent["key"] == "xkeysib-test"
    assert sent["body"]["sender"] == {"name": "AAAI", "email": "sender@gmail.com"}
    assert sent["body"]["to"] == [{"email": "person@gmail.com"}]
    assert "token=abc" in sent["body"]["htmlContent"]
