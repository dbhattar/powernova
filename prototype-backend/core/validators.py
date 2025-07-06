from typing_extensions import cast
from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator

from core.utils.app_setting import get_config


def validate_image(value):
    """
    Validate avatar file extension and size
    default values from db
    """
    from core.models import AppSetting

    config: AppSetting = cast(AppSetting, get_config())
    allowed_extensions = config.get_image_extensions_list()
    max_size_MB = config.get_image_max_size_MB()
    max_size = config.get_image_max_size_bytes()
    if value.size > max_size:
        raise ValidationError(
            f"Avatar size should be less than {max_size_MB} MB",
            params={"value": value},
        )
    return FileExtensionValidator(allowed_extensions)(value)
