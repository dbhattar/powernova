from django.contrib import admin
from django.utils.translation import gettext_lazy as _

from substation import models


class CountyAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "state",
    ]
    list_filter = ("state",)
    search_fields = ("name", "state")
    ordering = ("name",)


admin.site.register(models.County, CountyAdmin)


class SubstaionStatusInline(admin.TabularInline):
    model = models.SubstationStatus
    extra = 0


class SubstationPolicyPortfolioInline(admin.TabularInline):
    model = models.SubstationPolicyPortfolio
    extra = 0


class SubstationQueueInline(admin.TabularInline):
    model = models.SubstationQueue
    extra = 0


class HasGeoLocationFilter(admin.SimpleListFilter):
    title = _("Has Geo Location")
    parameter_name = "has_geo_location"

    def lookups(self, request, model_admin):
        return (
            ("yes", _("Yes")),
            ("no", _("No")),
        )

    def queryset(self, request, queryset):
        if self.value() == "yes":
            return queryset.filter(geo_coordinates__isnull=False)
        elif self.value() == "no":
            return queryset.filter(geo_coordinates__isnull=True)
        return queryset


class SubstationAdmin(admin.ModelAdmin):
    inlines = [
        SubstaionStatusInline,
        SubstationQueueInline,
        SubstationPolicyPortfolioInline,
    ]
    list_display = [
        "name",
        "county",
        "code",
        "voltage",
        "study_region",
        "utility_area",
        "type",
        "interconnecting_entity",
    ]
    list_filter = (
        "type",
        HasGeoLocationFilter,
        "interconnecting_entity",
        "voltage",
    )
    search_fields = ("name",)
    ordering = ("name",)

    def has_geo_location(self, obj):
        return obj.geo_coordinates is not None

    has_geo_location.boolean = True
    has_geo_location.short_description = "Has Geo Location"


admin.site.register(models.Substation, SubstationAdmin)


class SubstationLMPAdmin(admin.ModelAdmin):
    list_display = [
        "substation",
        "time",
        "market",
    ]
    list_filter = (
        "market",
        "substation",
    )
    search_fields = ("substation__name", "time", "market")
    ordering = ("substation", "time")
    date_hierarchy = "time"


admin.site.register(models.SubstationLMP, SubstationLMPAdmin)


class TransmissionLineAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "voltage",
    ]
    search_fields = ("name",)
    ordering = ("name",)


admin.site.register(models.TransmissionLine, TransmissionLineAdmin)


class AverageSubstationLMPAdmin(admin.ModelAdmin):
    list_display = [
        "substation",
        "time",
        "type",
    ]
    list_filter = (
        "type",
    )
    search_fields = ("substation__name", "time")
    ordering = ("substation", "time")
    date_hierarchy = "time"


admin.site.register(models.AverageLMP, AverageSubstationLMPAdmin)