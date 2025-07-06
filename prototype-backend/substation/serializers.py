from rest_framework import serializers

from substation.models import County
from substation.models import Substation
from substation.models import AverageLMP
from substation.models import SubstationLMP
from substation.models import SubstationQueue
from substation.models import SubstationStatus
from substation.models import TransmissionLine
from substation.models import SubstationPolicyPortfolio


class CountyOut(serializers.ModelSerializer):
    class Meta:
        model = County
        exclude = ["created_at", "updated_at", "id"]


class TransmissionLineOut(serializers.ModelSerializer):
    geo_coordinates = serializers.SerializerMethodField()

    class Meta:
        model = TransmissionLine
        exclude = ["created_at", "updated_at", "is_active", "id"]

    def get_geo_coordinates(self, obj):
        return list(obj.geo_coordinates.coords)


class SubstationLMPOut(serializers.ModelSerializer):
    lmp = serializers.SerializerMethodField()
    substation = serializers.SerializerMethodField()

    class Meta:
        model = SubstationLMP
        fields = ["energy", "congestion", "loss", "lmp", "time", "substation", "market"]

    def get_lmp(self, obj):
        return obj.energy + obj.congestion + obj.loss

    def get_substation(self, obj):
        return {
            "id": obj.substation.id,
            "name": f"{obj.substation.name} {int(obj.substation.voltage)} kV",
        }


class SubstationStatusOut(serializers.ModelSerializer):
    class Meta:
        model = SubstationStatus
        fields = ["type", "available_capacity", "no_of_constraints"]


class SubstationQueueOut(serializers.ModelSerializer):
    class Meta:
        model = SubstationQueue
        fields = ["queue", "no_of_projects"]


class SubstationPolicyPortfolioOut(serializers.ModelSerializer):
    class Meta:
        model = SubstationPolicyPortfolio
        fields = ["policy_portfolio", "year"]


class SubstationOut(serializers.ModelSerializer):
    county = CountyOut(read_only=True, many=False)
    geo_coordinates = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()
    status = SubstationStatusOut(
        source="substationstatus_set", many=True, read_only=True
    )
    queue = SubstationQueueOut(
        source="substationqueue_set",
        many=True,
        read_only=True,
    )
    policy_portfolio = SubstationPolicyPortfolioOut(
        source="substationpolicyportfolio_set", many=True, read_only=True
    )
    has_lmp_data = serializers.BooleanField()

    class Meta:
        model = Substation
        exclude = ["created_at", "updated_at", "is_active"]

    def get_geo_coordinates(self, obj):
        if obj.geo_coordinates is None:
            return None
        return {
            "latitude": obj.geo_coordinates.y,
            "longitude": obj.geo_coordinates.x,
        }

    def get_name(self, obj: Substation):
        return f"{obj.name} {int(obj.voltage)} kV" if obj.voltage else obj.name


class AverageLMPOut(serializers.ModelSerializer):

    class Meta:
        model = AverageLMP
        fields = ["energy", "congestion", "loss", "total_lmp", "time", "market"]
