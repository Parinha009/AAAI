"""Email delivery (SRS-3.3 Email Delivery Service).

Sends the magic-link sign-in email - over SMTP, or through Brevo's HTTPS API when
BREVO_API_KEY is set (for hosts that block outgoing SMTP, like Render's free plan).
Python stdlib only - no extra dependency. When `email_enabled` is False (dev
default) the link is logged instead of sent, so the flow stays testable.
"""

import json
import logging
import smtplib
import ssl
import urllib.error
import urllib.request
from email.message import EmailMessage
from email.utils import parseaddr

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


# Reserved / demo TLDs that can never receive mail (RFC 2606/6761). Sending to
# them only produces bounce messages, so log the link instead.
_UNDELIVERABLE_TLDS = (".local", ".test", ".invalid", ".example", ".localhost")


def _is_undeliverable(email: str) -> bool:
    domain = email.rsplit("@", 1)[-1].lower()
    return domain.endswith(_UNDELIVERABLE_TLDS)


def send_magic_link(to_email: str, link: str) -> None:
    """Send (or, in dev / for demo addresses, log) the passwordless sign-in link."""
    if not settings.email_enabled or _is_undeliverable(to_email):
        logger.info("[DEV EMAIL] magic-link for %s -> %s", to_email, link)
        return

    if not settings.smtp_host:
        raise RuntimeError("email_enabled is True but SMTP_HOST is not configured")

    text, html = _bodies(link)
    if settings.brevo_api_key:
        _deliver_brevo(to_email, text, html)
        return

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


BREVO_URL = "https://api.brevo.com/v3/smtp/email"


def _deliver_brevo(to_email: str, text: str, html: str) -> None:
    """Send through Brevo's transactional email API (HTTPS, port 443)."""
    sender_name, sender_email = parseaddr(settings.smtp_from)
    body = json.dumps({
        "sender": {"name": sender_name or "AAAI", "email": sender_email},
        "to": [{"email": to_email}],
        "subject": _SUBJECT,
        "textContent": text,
        "htmlContent": html,
    }).encode("utf-8")
    request = urllib.request.Request(
        BREVO_URL,
        data=body,
        method="POST",
        headers={
            "api-key": settings.brevo_api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            response.read()
    except urllib.error.HTTPError as exc:
        # Keep Brevo's explanation (e.g. "account not activated", "sender not valid").
        detail = exc.read().decode("utf-8", "replace")[:500]
        raise RuntimeError(f"Brevo refused the email (HTTP {exc.code}): {detail}") from exc
    logger.info("Sent magic-link email to %s via Brevo", to_email)
