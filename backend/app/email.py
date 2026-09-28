"""Email delivery (SRS-3.3 Email Delivery Service).

Sends the magic-link sign-in email over SMTP (Python stdlib — no extra dependency).
When `email_enabled` is False (dev default) the link is logged instead of sent, so
the flow stays testable without a mail server.
"""

import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.config import settings

logger = logging.getLogger("aaai.email")

_SUBJECT = "Your AAAI sign-in link"


def _bodies(link: str) -> tuple[str, str]:
    minutes = settings.magic_link_ttl_seconds // 60
    text = (
        "Welcome to AAAI.\n\n"
        f"Click the link below to sign in. It expires in {minutes} minutes and can be "
        f"used only once:\n\n{link}\n\n"
        "If you didn't request this, you can ignore this email."
    )
    html = (
        '<div style="font-family:system-ui,Arial,sans-serif;max-width:480px;margin:auto">'
        "<h2>Sign in to AAAI</h2>"
        f"<p>Click the button below to sign in. It expires in {minutes} minutes and "
        "can be used only once.</p>"
        f'<p><a href="{link}" style="display:inline-block;padding:12px 20px;'
        'background:#2e7d32;color:#fff;border-radius:8px;text-decoration:none">'
        "Sign in</a></p>"
        f'<p style="color:#666;font-size:13px">Or paste this link:<br>{link}</p>'
        "</div>"
    )
    return text, html


def send_magic_link(to_email: str, link: str) -> None:
    """Send (or, in dev, log) the passwordless sign-in link."""
    if not settings.email_enabled:
        logger.info("[DEV EMAIL] magic-link for %s -> %s", to_email, link)
        return

    if not settings.smtp_host:
        raise RuntimeError("email_enabled is True but SMTP_HOST is not configured")

    text, html = _bodies(link)
    msg = EmailMessage()
    msg["Subject"] = _SUBJECT
    msg["From"] = settings.smtp_from
    msg["To"] = to_email
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")

    _deliver(msg)


def _deliver(msg: EmailMessage) -> None:
    host, port = settings.smtp_host, settings.smtp_port
    if settings.smtp_use_ssl:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(host, port, context=context, timeout=15) as server:
            _auth_and_send(server, msg)
    else:
        with smtplib.SMTP(host, port, timeout=15) as server:
            if settings.smtp_use_tls:
                server.starttls(context=ssl.create_default_context())
            _auth_and_send(server, msg)


def _auth_and_send(server: smtplib.SMTP, msg: EmailMessage) -> None:
    if settings.smtp_user:
        server.login(settings.smtp_user, settings.smtp_password)
    server.send_message(msg)
    logger.info("Sent magic-link email to %s", msg["To"])
