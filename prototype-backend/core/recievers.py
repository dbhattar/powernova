from django.dispatch import receiver

from django.db.models.signals import post_save

from core.models import AppSetting
from core.models import ContactUs
from core.tasks import send_email_task
from core.utils.email_templates import create_contact_us_email_to_admin_template


@receiver(post_save, sender=ContactUs)
def send_email_to_admin_on_contact_us(sender, instance: ContactUs, created, **kwargs):
    if not created:
        return
    subject = f"New message from {instance.name} for {instance.type} on Cosmic Global Technologies"  # noqa
    message = create_contact_us_email_to_admin_template(
        name=instance.name,
        email=instance.email,
        message=instance.message,
        type_=instance.type,  # noqa
    )
    config: AppSetting | None = AppSetting.objects.first()
    if not config or not config.admin_emails:
        return
    for admin_email in config.admin_emails:
        send_email_task(
            to=admin_email,
            subject=subject,
            text=message,
            html=message,
        )
