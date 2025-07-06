from django.contrib.auth.models import Group
from django.contrib.auth.models import Permission
from django.contrib.auth.models import AbstractUser
from django.contrib.postgres.fields import ArrayField

from django.contrib.gis.db import models

from core.choices import FileExtensionChoices
from core.choices import CountryChoices
from core.choices import GenderChoices
from core.managers import UserManager
from core.validators import validate_image
from core.base_models import CgBaseModel


class FileExtension(models.Model):
    extension = models.CharField(
        max_length=5, choices=FileExtensionChoices.choices, unique=True
    )

    def __str__(self):
        return self.extension


class AppSetting(models.Model):
    id = models.CharField(max_length=7, null=False, primary_key=True, default="default")
    image_max_size = models.FloatField("image max size (MB)", default=2.0)
    image_extensions = models.ManyToManyField(
        FileExtension, verbose_name="allowed image extensions"
    )
    admin_emails = ArrayField(
        models.EmailField(),
        verbose_name="admin emails",
        default=list,
        null=True,
        blank=True,
    )

    def get_image_max_size_MB(self):
        return round(self.image_max_size, 2)

    def get_image_max_size_bytes(self):
        return int(self.image_max_size * 1000 * 1000)

    def get_image_extensions_list(self):
        return [e.extension for e in self.image_extensions.all()]

    def __str__(self):
        return self.id

    class Meta:
        verbose_name = "App Setting"
        verbose_name_plural = "App Settings"

    def save(self, *args, **kwargs):
        self.id = "default"
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        pass


class CgUser(AbstractUser, CgBaseModel):
    """Auth related fields:
    uuid
    email, password
    is_staff, is_superuser
    is_active, date_joined, last_login
    created_at, updated_at
    """

    objects: UserManager["CgUser"] = UserManager()  # type: ignore
    first_name = None
    last_name = None
    username = None

    email = models.EmailField(
        "email address",
        unique=True,
        error_messages={
            "unique": "A user with that email already exists.",
        },
    )
    is_email_verified = models.BooleanField(default=False)

    # Fix reverse accessor clashes by adding unique related_name
    groups = models.ManyToManyField(
        Group,
        related_name="cguser_set",
        blank=True,
        help_text="The groups this user belongs to.",
        verbose_name="groups",
    )
    user_permissions = models.ManyToManyField(
        Permission,
        related_name="cguser_permissions_set",
        blank=True,
        help_text="Specific permissions for this user.",
        verbose_name="user permissions",
    )

    EMAIL_FIELD = "email"
    # login by email (custom backend)
    USERNAME_FIELD = "email"
    # createsuperuser requires: (email, password)
    # both added by default
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.email

    @property
    def has_profile(self) -> bool:
        return hasattr(self, "profile")

    @property
    def full_name(self) -> str:
        return (
            f"{self.profile.first_name} {self.profile.last_name}"  # type: ignore
            if self.has_profile
            else self.email.split("@")[0].title()
        )


class UserProfile(CgBaseModel):
    user = models.OneToOneField(
        CgUser,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    avatar = models.ImageField(
        upload_to="images/avatars/",
        validators=[validate_image],
        blank=True,
        null=True,
    )
    first_name = models.CharField(max_length=150)
    middle_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150)
    gender = models.CharField(
        max_length=17,
        choices=GenderChoices.choices,
        default=GenderChoices.UNKNOWN,
    )
    country = models.CharField(
        max_length=2, choices=CountryChoices.choices, default="US"
    )

    def __str__(self):
        return self.user.email


class ContactUs(CgBaseModel):
    class ContactType(models.TextChoices):
        DEMO = "demo", "Demo"
        ENQUIRY = "enquiry", "Enquiry"
        FEEDBACK = "feedback", "Feedback"

    name = models.CharField(max_length=255)
    email = models.EmailField()
    message = models.TextField(blank=True)
    phone_number = models.CharField(max_length=20, blank=True)
    subscribe_to_newsletter = models.BooleanField(default=False)
    type = models.CharField(
        max_length=20, choices=ContactType.choices, default=ContactType.ENQUIRY
    )
    company = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Contact Us"
        verbose_name_plural = "Contact Us"
