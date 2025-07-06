from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from core.choices import CountryChoices
from core.choices import GenderChoices
from core.choices import SiteThemeChoices
from core.choices import StateChoices
from core.choices import RegionChoices


class MappingsView(APIView):
    def get(self, request):
        data = {
            "gender": dict(GenderChoices.choices),
            "country": dict(CountryChoices.choices),
            "site_theme": dict(SiteThemeChoices.choices),
            "state": dict(StateChoices.choices),
            "region": dict(RegionChoices.choices),
        }
        return Response({"data": data})
