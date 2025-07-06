from django.db.models import OuterRef
from django.db.models import Prefetch
from django.db.models import Exists
from django_filters import rest_framework as filters
from django.http import StreamingHttpResponse


from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import filters as drf_filters
from rest_framework.permissions import IsAuthenticated

from core.base_views import BaseReadOnlyAPIView
from core.renderers import generate_json_response

from substation.models import County
from substation.models import Substation
from substation.models import AverageLMP
from substation.models import SubstationLMP
from substation.models import SubstationQueue
from substation.models import SubstationStatus
from substation.models import TransmissionLine
from substation.models import SubstationLMPMarket
from substation.models import SubstationPolicyPortfolio

from substation.serializers import CountyOut
from substation.serializers import SubstationOut
from substation.serializers import AverageLMPOut
from substation.serializers import TransmissionLineOut

from substation.filters import SubstationFilter
from substation.filters import AverageLMPFilter


class CountyListAPIView(BaseReadOnlyAPIView):
    queryset_class = County
    serializer_class = CountyOut
    search_fields = ["name"]
    permission_classes = [IsAuthenticated]
    queryset = County.objects.all()


class TransmissionLineListAPIView(BaseReadOnlyAPIView):
    queryset_class = TransmissionLine
    serializer_class = TransmissionLineOut
    permission_classes = [IsAuthenticated]
    queryset = TransmissionLine.objects.all()


class AverageLMPListAPIView(BaseReadOnlyAPIView):
    queryset_class = AverageLMP
    serializer_class = AverageLMPOut
    queryset = AverageLMP.timescale.all().order_by("time")
    filter_backends = [filters.DjangoFilterBackend, drf_filters.SearchFilter]
    filterset_class = AverageLMPFilter
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        substation_ids = request.query_params.get("ids", "").split(",")
        if not substation_ids:
            return Response(
                {"error": "Please provide at least one substation ID."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        queryset = self.filter_queryset(self.get_queryset())
        queryset = queryset.filter(substation_id__in=substation_ids)

        column_headers = [
            "Substation",
            "Substation ID",
            "Energy",
            "Congestion",
            "Loss",
            "LMP",
            "Opening Price",
            "Closing Price",
            "Time",
        ]

        def row_transform(obj):
            return [
                obj.substation.name if obj.substation else "",
                str(obj.substation.id) if obj.substation else "",
                str(obj.energy),
                str(obj.congestion),
                str(obj.loss),
                str(obj.total_lmp),
                str(obj.opening_price),
                str(obj.closing_price),
                str(obj.time),
            ]

        response_generator = generate_json_response(
            queryset, column_headers, row_transform
        )

        return StreamingHttpResponse(
            response_generator,
            content_type="text/event-stream",
        )


class SubstationListAPIView(BaseReadOnlyAPIView):
    queryset_class = Substation
    serializer_class = SubstationOut
    filter_backends = [filters.DjangoFilterBackend, drf_filters.SearchFilter]
    filterset_class = SubstationFilter
    permission_classes = [IsAuthenticated]

    MIN_SUBSTATIONS_TO_COMPARE = 2
    MAX_SUBSTATIONS_TO_COMPARE = 5

    def get_queryset(self):
        return (
            Substation.objects.all()
            .prefetch_related(
                Prefetch(
                    "substationstatus_set",
                    queryset=SubstationStatus.objects.filter(is_active=True),
                ),
                Prefetch(
                    "substationqueue_set",
                    queryset=SubstationQueue.objects.filter(is_active=True),
                ),
                Prefetch(
                    "substationpolicyportfolio_set",
                    queryset=SubstationPolicyPortfolio.objects.filter(is_active=True),
                ),
            )
            .annotate(
                has_lmp_data=Exists(
                    SubstationLMP.objects.filter(
                        substation_id=OuterRef("id"),
                        market=SubstationLMPMarket.RTM_5min,
                    )
                )
            )
            .distinct("id")
        )

    def validate_substation_ids(self, substation_ids):
        """
        Validate the number of substation IDs provided.
        """
        num_substations = len(substation_ids)
        if not (
            self.MIN_SUBSTATIONS_TO_COMPARE
            <= num_substations
            <= self.MAX_SUBSTATIONS_TO_COMPARE
        ):
            return Response(
                {
                    "error": f"Please provide between {self.MIN_SUBSTATIONS_TO_COMPARE} and {self.MAX_SUBSTATIONS_TO_COMPARE} substation IDs."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return None

    @action(detail=False, methods=["get"], url_path="compare")
    def compare(self, request):
        """
        Retrieve data for specified substations, validating the number of substations provided.
        """
        substation_ids = request.query_params.get("substation_ids", "").split(",")
        error_response = self.validate_substation_ids(substation_ids)
        if error_response:
            return error_response

        substations = Substation.objects.filter(id__in=substation_ids)
        serializer = self.get_serializer(substations, many=True)
        return Response({"data": serializer.data}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="mappings")
    def mappings(self, request):
        substations = Substation.objects.values(
            "type", "interconnecting_entity", "study_region", "utility_area"
        )

        mappings_dict = {}
        for substation in substations:
            substation_type = substation["type"]
            interconnecting_entity = substation["interconnecting_entity"]
            study_region = substation["study_region"]
            utility_area = substation["utility_area"]

            if substation_type not in mappings_dict:
                mappings_dict[substation_type] = {}

            if interconnecting_entity not in mappings_dict[substation_type]:
                mappings_dict[substation_type][interconnecting_entity] = {
                    "study_regions": set(),
                    "utility_areas": set(),
                }

            mappings_dict[substation_type][interconnecting_entity]["study_regions"].add(
                study_region
            )
            mappings_dict[substation_type][interconnecting_entity]["utility_areas"].add(
                utility_area
            )

        mappings = [
            [
                substation_type,
                interconnecting_entity,
                list(data["study_regions"]),
                list(data["utility_areas"]),
            ]
            for substation_type, entities in mappings_dict.items()
            for interconnecting_entity, data in entities.items()
        ]

        return Response(
            {
                "data": {
                    "columns": [
                        "Substation Type",
                        "Interconnecting Entity",
                        "Study Regions",
                        "Utility Areas",
                    ],
                    "rows": mappings,
                }
            },
            status=status.HTTP_200_OK,
        )
