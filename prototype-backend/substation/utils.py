import pytz
import requests
import gridstatus
import pandas as pd

from datetime import datetime
from datetime import timedelta

from django.db.models import F
from django.db.models import Q
from django.db.models import Avg
from django.utils import timezone

from substation import models

from utils.cosmic_ai_requests import get_forecased_data
from project.env import ENV
import logging

logger = logging.getLogger(__name__)


def get_last_lmp_date(
    market: str, interconnecting_entity: str = "CAISO"
) -> datetime | None:
    last_lmp = (
        models.SubstationLMP.objects.filter(
            substation__interconnecting_entity=interconnecting_entity,
            market=market,
        )
        .select_related("substation")
        .order_by("-time")
        .first()
    )
    if last_lmp:
        return last_lmp.time
    return None


def load_lmp_from_date_range(start_datetime: str, end_datetime: str, market: str):
    iso = gridstatus.CAISO()
    start = pd.Timestamp(start_datetime)
    end = pd.Timestamp(end_datetime)
    current = start
    while current < end:
        next_ = min(current + pd.Timedelta(hours=1), end)
        print(f"Fetching data from {current} to {next_}")

        lmp_data = iso.get_lmp(
            locations="all",
            market=(
                gridstatus.Markets.DAY_AHEAD_HOURLY
                if market == models.SubstationLMPMarket.DAM
                else gridstatus.Markets.REAL_TIME_5_MIN
            ),
            date=current.strftime("%Y-%m-%dT%H:%M"),
            end=next_.strftime("%Y-%m-%dT%H:%M"),
        )
        for _, row in lmp_data.iterrows():
            try:
                substation = models.Substation.objects.filter(
                    code=row["Location"]
                ).first()
                if not substation:
                    continue
                models.SubstationLMP.objects.get_or_create(
                    substation=substation,
                    energy=row["Energy"],
                    congestion=row["Congestion"],
                    loss=row["Loss"],
                    time=row["Time"],
                    market=market,
                )
                logger.info(
                    f"Substation LMP created: {row['Location']} ({row['Time']})"
                )
            except Exception as e:
                logger.error(f"Error creating Substation LMP: {e}")
                continue

        current = next_


def calculate_avg_lmp_from_date_range(
    substation,
    start_date_time: str,
    end_date_time: str,
):
    utc = pytz.timezone("UTC")
    start_date_time_pst = datetime.strptime(start_date_time, "%Y%m%dT%H:%M%z")
    end_date_time_pst = datetime.strptime(end_date_time, "%Y%m%dT%H:%M%z")
    start_date_time_utc = start_date_time_pst.astimezone(utc)
    end_date_time_utc = end_date_time_pst.astimezone(utc)

    lmps = (
        models.SubstationLMP.timescale.filter(
            time__gte=start_date_time_utc,
            time__lte=end_date_time_utc,
            substation=substation,
        )
        .annotate(
            avg_energy=Avg(
                "energy", filter=Q(market=models.SubstationLMPMarket.RTM_5min)
            ),
            avg_congestion=Avg(
                "congestion", filter=Q(market=models.SubstationLMPMarket.RTM_5min)
            ),
            avg_loss=Avg("loss", filter=Q(market=models.SubstationLMPMarket.RTM_5min)),
        )
        .values(
            "avg_energy",
            "avg_congestion",
            "avg_loss",
        )
        .annotate(
            avg_lmp=F("avg_energy") + F("avg_congestion") + F("avg_loss"),
        )
    )
    return lmps


def get_last_date_for_avg_lmp_for_substation_by_type(substation, type_):
    last_entry = (
        models.AverageLMP.objects.filter(substation=substation, type=type_)
        .order_by("-time")
        .first()
    )
    if last_entry:
        return last_entry.time
    return None


def forcast_and_save_avg_lmp():
    for substation in models.Substation.objects.filter(code__isnull=False):
        actual_lmps_each_day = list(
            models.AverageLMP.objects.filter(
                substation=substation,
                type=models.AverageLMPType.ACTUAL,
            ).values("time", "total_lmp")
        )

        if not actual_lmps_each_day:
            continue

        for lmp in actual_lmps_each_day:
            lmp["time"] = lmp["time"].strftime("%Y%m%dT%H:%M%z")

        forecasted_data = get_forecased_data(
            {
                "prediction_context": "total_lmp",
                "forecast_length": ENV.FORECAST_LENGTH,
                "data": actual_lmps_each_day,
            }
        )

        if forecasted_data.status == "success":
            last_date_of_forecast = get_last_date_for_avg_lmp_for_substation_by_type(
                substation, models.AverageLMPType.FORECAST
            )

            if last_date_of_forecast:
                start_date = last_date_of_forecast + timedelta(days=1)
            else:
                start_date = timezone.now()

            forecasted_data = forecasted_data.data["data"]
            for data in forecasted_data:
                try:
                    models.AverageLMP.objects.get_or_create(
                        substation=substation,
                        type=models.AverageLMPType.FORECAST,
                        time=start_date,
                        defaults={"total_lmp": data},
                    )
                    start_date += timedelta(days=1)
                    logger.info(
                        f"Forecasted LMP created: {substation.code} ({start_date})"
                    )
                except Exception as e:
                    logger.error(f"Error saving forecast data: {e}")
        else:
            logger.error(f"Error in forecasting: {forecasted_data.error}")
            continue
