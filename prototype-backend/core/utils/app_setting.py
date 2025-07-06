from django.apps import apps


def get_config():
    settings, _ = apps.get_model("core", "AppSetting").objects.get_or_create(
        id="default"
    )
    return settings
