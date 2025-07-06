from django.apps import AppConfig


class SubstationConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "substation"

    def ready(self):
        import substation.cron_jobs  # noqa: F401
