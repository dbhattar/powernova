from django_filters import rest_framework as filters

from substation.models import Substation
from substation.models import AverageLMP
from substation.models import SubstationLMP


class SubstationFilter(filters.FilterSet):
    name = filters.CharFilter(field_name="name", lookup_expr="icontains")
    type = filters.CharFilter(field_name="type", lookup_expr="icontains")
    county__name = filters.CharFilter(
        field_name="county__name", lookup_expr="icontains"
    )
    voltage = filters.RangeFilter(field_name="voltage")
    geo_coordinates = filters.CharFilter(method="filter_geo_coordinates")
    study_region = filters.CharFilter(
        field_name="study_region", lookup_expr="icontains"
    )
    utility_area = filters.CharFilter(
        field_name="utility_area", lookup_expr="icontains"
    )
    interconnecting_entity = filters.CharFilter(
        field_name="interconnecting_entity", lookup_expr="icontains"
    )
    available_capacity = filters.RangeFilter(
        field_name="substationstatus__available_capacity"
    )
    no_of_constraints = filters.RangeFilter(
        field_name="substationstatus__no_of_constraints"
    )
    queue = filters.RangeFilter(field_name="substationqueue__queue")
    no_of_projects = filters.RangeFilter(field_name="substationqueue__no_of_projects")
    policy_portfolio = filters.RangeFilter(
        field_name="substationpolicyportfolio__policy_portfolio"
    )
    year = filters.RangeFilter(field_name="substationpolicyportfolio__year")

    def filter_geo_coordinates(self, queryset, name, value):
        try:
            lat, lon = map(float, value.split(","))
            return queryset.filter(geo_coordinates__x=lat, geo_coordinates__y=lon)
        except ValueError:
            return queryset  # Return unfiltered if input format is incorrect

    class Meta:
        model = Substation
        fields = [
            "name",
            "type",
            "county__name",
            "voltage",
            "study_region",
            "utility_area",
            "interconnecting_entity",
            "available_capacity",
            "no_of_constraints",
            "queue",
            "no_of_projects",
            "policy_portfolio",
            "year",
        ]


class SubstationLMPFilter(filters.FilterSet):
    market = filters.CharFilter(field_name="market", lookup_expr="iexact")
    time = filters.DateFromToRangeFilter(field_name="time")

    class Meta:
        model = SubstationLMP
        fields = ["market", "time"]


class AverageLMPFilter(filters.FilterSet):
    type = filters.CharFilter(field_name="type", lookup_expr="iexact")
    time = filters.DateFromToRangeFilter(field_name="time")

    class Meta:
        model = AverageLMP
        fields = {
            "type": ["iexact"],
            "time": ["gte", "lte"],
        }
