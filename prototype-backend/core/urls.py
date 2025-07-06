from django.urls import path, include

from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.views import TokenRefreshView


from core.views.user import RegisterView
from core.views.misc import MappingsView
from core.views.user import ContactUsView

urlpatterns = [
    path("", include("substation.urls")),
    path("login/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("login/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    # path("register/", RegisterView.as_view(), name="register"),
    path("mappings/", MappingsView.as_view(), name="mappings"),
    path("contact/", ContactUsView.as_view(), name="contact"),
]
