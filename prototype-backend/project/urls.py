from project import settings
from django.contrib import admin
from django.urls import path
from django.urls import include
from django.conf.urls.static import static

admin.site.site_header = "Cosmic Global Admin"
admin.site.site_title = "Cosmic Global Admin"
admin.site.index_title = "Cosmic Global Admin Dashboard"

urlpatterns = (
    [
        path("admin/", admin.site.urls),
        path("api/v1/", include("core.urls")),
    ]
    + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
)
