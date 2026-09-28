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
        email_mod.send_magic_link("cand@demo.local", "http://localhost/auth?token=ABC123")

        server.send_message.assert_called_once()
        msg = server.send_message.call_args[0][0]
        assert msg["To"] == "cand@demo.local"
        assert msg["Subject"] == "Your AAAI sign-in link"
        assert "ABC123" in msg.as_string()  # the magic link is in the email


def test_enabled_without_host_raises(monkeypatch):
    monkeypatch.setattr(settings, "email_enabled", True)
    monkeypatch.setattr(settings, "smtp_host", "")
    with pytest.raises(RuntimeError):
        email_mod.send_magic_link("x@y.com", "http://link")
