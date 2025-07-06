import requests
import logging
from io import BytesIO
from typing import Optional
from requests.auth import HTTPBasicAuth

from core.models import AppSetting

from project.env import ENV

logger = logging.getLogger(__name__)


def send_mailgun_email(
    to: str,
    subject: str,
    text: str,
    html: str,
    cc=[],
    bcc=[],
    attachment: Optional[BytesIO] = None,
    attachment_name: Optional[str] = None,
    domain: str = "cosmicglobaltech.com",
):
    config: AppSetting | None = AppSetting.objects.first()

    if not config or not config.admin_emails:
        return

    if not ENV.DEBUG and to not in config.admin_emails:
        return

    frm = "no-reply@" + domain
    data = {
        "from": frm,
        "to": [to],
        "cc": cc,
        "bcc": bcc,
        "subject": subject,
        "html": html,
        "text": text,
    }
    files = []
    if attachment and attachment_name:
        files = [("attachment", (attachment_name, attachment))]
    resp = requests.post(
        f"https://api.mailgun.net/v3/{ENV.MAILGUN_HOSTNAME}/messages",  # noqa
        auth=HTTPBasicAuth("api", ENV.MAILGUN_API_KEY),
        data=data,
        files=files or None,
    )
    if resp.status_code > 300 or resp.status_code < 200:
        logger.error(
            f"Failed to send email to {to}. Response: {resp.status_code} {resp.text}"
        )
