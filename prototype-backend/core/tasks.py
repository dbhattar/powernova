from io import BytesIO
from typing import Optional

from huey.contrib.djhuey import task

from core.utils.email_service import send_mailgun_email


@task()
def send_email_task(
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
    send_mailgun_email(
        to=to,
        subject=subject,
        text=text,
        html=html,
        cc=cc,
        bcc=bcc,
        attachment=attachment,
        attachment_name=attachment_name,
        domain=domain,
    )
