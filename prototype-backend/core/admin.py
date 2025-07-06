from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from form_action import ExtraButtonMixin

from core import models
from core.actions import add_all_file_extensions


class AppSettingAdmin(ExtraButtonMixin, admin.ModelAdmin):
    list_display = [
        "id",
        "image_max_size",
    ]
    filter_horizontal = ("image_extensions",)
    extra_buttons = (add_all_file_extensions,)


admin.site.register(models.AppSetting, AppSettingAdmin)


class UserProfileInline(admin.StackedInline):
    model = models.UserProfile


class UserAdmin(BaseUserAdmin):
    inlines = [UserProfileInline]
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Additional Info", {"fields": ("is_email_verified",)}),
        (
            "Permissions",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                ),
            },
        ),
        (
            "Important dates",
            {
                "fields": (
                    "last_login",
                    "date_joined",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "password1", "password2"),
            },
        ),
    )

    readonly_fields = [
        "last_login",
        "date_joined",
        "created_at",
        "updated_at",
    ]

    list_display = (
        "email",
        "is_email_verified",
        "is_superuser",
        "is_staff",
        "_has_profile",
        "is_active",
        "last_login",
        "date_joined",
    )

    list_filter = (
        "profile__gender",
        "is_staff",
        "is_superuser",
        "is_active",
        "groups",
        "last_login",
        "date_joined",
    )

    search_fields = (
        "email",
        "profile__first_name",
        "profile__last_name",
        "profile__country",
    )
    ordering = ("-created_at",)

    def _has_profile(self, obj):
        return obj.has_profile

    _has_profile.boolean = True


admin.site.register(models.CgUser, UserAdmin)


@admin.register(models.ContactUs)
class ContactUsAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "email",
        "company",
        "message",
        "created_at",
    ]
    search_fields = ["name", "email", "company", "message"]
    list_filter = ["created_at"]
    readonly_fields = ["created_at"]
    date_hierarchy = "created_at"
