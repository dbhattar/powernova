from django.contrib.gis.db import models

from django.db.models import Q
from timescale.db.models.models import TimescaleModel

from core.choices import StateChoices
from core.choices import CountryChoices
from core.base_models import CgBaseModel


class County(CgBaseModel):
    name = models.CharField(max_length=150, unique=True)
    country = models.CharField(
        max_length=2, choices=CountryChoices.choices, default="US"
    )
    state = models.CharField(max_length=2, choices=StateChoices.choices, default="CA")

    def __str__(self):
        return self.name

    class Meta:
        verbose_name_plural = "Counties"


class SubstationType(models.TextChoices):
    TRANSMISSION = "transmission", "Transmission"
    DISTRIBUTION = "distribution", "Distribution"


class Substation(CgBaseModel):
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=50, blank=True, null=True)
    voltage = models.FloatField(help_text="Voltage (kV)", null=True, blank=True)
    county = models.ForeignKey(
        County,
        on_delete=models.CASCADE,
        blank=True,
        null=True,
    )
    geo_coordinates = models.PointField(
        help_text="Longitude Latitude", blank=True, null=True
    )
    study_region = models.CharField(max_length=255, blank=True, null=True)
    utility_area = models.CharField(max_length=255, blank=True, null=True)
    interconnecting_entity = models.CharField(max_length=255, blank=True, null=True)
    type = models.CharField(
        max_length=50,
        choices=SubstationType.choices,
        default=SubstationType.TRANSMISSION,
    )

    def __str__(self):
        return f"{self.name} ({self.voltage} kV)"

    class Meta:
        verbose_name_plural = "Substations"
        constraints = [
            models.UniqueConstraint(
                fields=["name", "voltage", "type", "interconnecting_entity"],
                condition=Q(type=SubstationType.TRANSMISSION),
                name="unique_transmission_substation",
            ),
            models.UniqueConstraint(
                fields=["name", "type", "interconnecting_entity"],
                condition=~Q(type=SubstationType.TRANSMISSION),
                name="unique_non_transmission_substation",
            ),
        ]


class DatasourceType(models.TextChoices):
    HEATMAP = "heatmap", "Heatmap"
    CONSTRAINT = "constraint", "Constraint"


class SubstationStatus(CgBaseModel):
    substation = models.ForeignKey(Substation, on_delete=models.CASCADE)
    type = models.CharField(
        max_length=50, choices=DatasourceType.choices, default=DatasourceType.HEATMAP
    )
    available_capacity = models.FloatField(
        help_text="Available Capacity (MW)", null=True, blank=True
    )
    no_of_constraints = models.IntegerField(
        help_text="Number of Constraints", null=True, blank=True
    )

    def __str__(self):
        return self.substation.name

    class Meta:
        verbose_name = "Substation Status"
        verbose_name_plural = "Substation Statuses"
        constraints = [
            models.UniqueConstraint(
                fields=["substation", "type"],
                condition=models.Q(is_active=True),
                name="unique_active_substation_status",
            )
        ]


class SubstationQueue(CgBaseModel):
    substation = models.ForeignKey(Substation, on_delete=models.CASCADE)
    queue = models.FloatField(help_text="Queue (MW)", null=True, blank=True)
    no_of_projects = models.IntegerField(
        help_text="Number of Projects", null=True, blank=True
    )

    def __str__(self):
        return self.substation.name

    class Meta:
        verbose_name = "Substation Queue"
        verbose_name_plural = "Substation Queues"
        constraints = [
            models.UniqueConstraint(
                fields=["substation"],
                condition=models.Q(is_active=True),
                name="unique_active_substation_queue",
            )
        ]


class SubstationPolicyPortfolio(CgBaseModel):
    substation = models.ForeignKey(Substation, on_delete=models.CASCADE)
    policy_portfolio = models.FloatField(
        help_text="Policy Portfolio (MW)", null=True, blank=True
    )
    year = models.IntegerField(help_text="Year")

    def __str__(self):
        return self.substation.name

    class Meta:
        verbose_name = "Policy Portfolio"
        verbose_name_plural = "Policy Portfolios"
        unique_together = ["substation", "year"]
        constraints = [
            models.UniqueConstraint(
                fields=["substation"],
                condition=models.Q(is_active=True),
                name="unique_active_substation_policy_portfolio",
            )
        ]


class SubstationLMPMarket(models.TextChoices):
    DAM = "DAM", "Day-Ahead Market"
    RTM_5min = "RTM_5min", "Real-Time Market (5-min)"


class SubstationLMP(TimescaleModel):
    substation = models.ForeignKey(Substation, on_delete=models.CASCADE)
    energy = models.FloatField(help_text="Energy LMP ($/MWh)", null=True, blank=True)
    congestion = models.FloatField(
        help_text="Congestion LMP ($/MWh)", null=True, blank=True
    )
    loss = models.FloatField(help_text="Loss LMP ($/MWh)", null=True, blank=True)
    market = models.CharField(
        max_length=50,
        choices=SubstationLMPMarket.choices,
        default=SubstationLMPMarket.DAM,
    )

    def __str__(self):
        return f"{self.substation.name}->{self.time}"


class TransmissionLine(CgBaseModel):
    name = models.CharField(max_length=150)
    voltage = models.FloatField(help_text="Voltage (kV)")
    utility_area = models.CharField(max_length=255, blank=True, null=True)
    circuit = models.CharField(max_length=50, blank=True, null=True)
    type = models.CharField(max_length=50, blank=True, null=True)
    geo_coordinates = models.LineStringField(
        help_text="LineString (Longitude Latitude)", blank=True, null=True
    )

    def __str__(self):
        return f"{self.name} ({self.voltage} kV)"


class AverageLMPType(models.TextChoices):
    FORECAST = "forecast", "Forecast"
    ACTUAL = "actual", "Actual"


class AverageLMP(TimescaleModel):
    substation = models.ForeignKey(Substation, on_delete=models.CASCADE)
    type = models.CharField(
        max_length=50, choices=AverageLMPType.choices, default=AverageLMPType.FORECAST
    )
    energy = models.FloatField(help_text="Energy LMP ($/MWh)", null=True, blank=True)
    congestion = models.FloatField(
        help_text="Congestion LMP ($/MWh)", null=True, blank=True
    )
    loss = models.FloatField(help_text="Loss LMP ($/MWh)", null=True, blank=True)
    total_lmp = models.FloatField(help_text="LMP ($/MWh)", null=True, blank=True)
    opening_price = models.FloatField(
        help_text="Opening Price ($/MWh)", null=True, blank=True
    )
    closing_price = models.FloatField(
        help_text="Closing Price ($/MWh)", null=True, blank=True
    )

    def __str__(self):
        return self.substation.name
