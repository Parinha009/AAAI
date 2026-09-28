"""Email delivery (SRS-3.3 Email Delivery Service).

In development (`email_enabled=False`) the magic link is logged instead of sent,
so the flow is testable without SMTP. Wire a real provider here for production.
"""

import logging

from app.config import settings

logger = logging.getLogger("aaai.email")


def send_magic_link(to_email: str, link: str) -> None:
    if settings.email_enabled:
        # TODO: integrate a real email provider (e.g. SMTP / SendGrid / SES).
        raise NotImplementedError("Real email delivery is not configured yet")
    logger.info("[DEV EMAIL] magic-link for %s -> %s", to_email, link)
