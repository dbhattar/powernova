from django.urls import path, include

from rest_framework.routers import DefaultRouter

from substation.views import CountyListAPIView
from substation.views import SubstationListAPIView
from substation.views import AverageLMPListAPIView
from substation.views import TransmissionLineListAPIView


router = DefaultRouter()
router.register(r"substations", SubstationListAPIView, basename="substation")
router.register(r"counties", CountyListAPIView, basename="county")
router.register(
    r"transmission-lines", TransmissionLineListAPIView, basename="transmission-line"
)
router.register(r"average-lmp", AverageLMPListAPIView, basename="average-lmp")

urlpatterns = [
    path("", include(router.urls)),
]
