import re
import logging
import gridstatus

from datetime import timedelta

from django.db.models import Q

from django.utils import timezone

from huey import crontab
from huey.contrib.djhuey import periodic_task

from substation.models import Substation
from substation.models import AverageLMP
from substation.models import SubstationLMP
from substation.models import AverageLMPType
from substation.models import SubstationType
from substation.models import SubstationQueue
from substation.models import SubstationLMPMarket

from substation.utils import load_lmp_from_date_range
from substation.utils import get_last_lmp_date

from substation.utils import calculate_avg_lmp_from_date_range


logger = logging.getLogger(__name__)


# Schedule to run twice a day
@periodic_task(crontab(minute="0", hour="*/12"))
def load_dam_lmp():
    last_update_date = get_last_lmp_date(SubstationLMPMarket.DAM)
    if not last_update_date:
        last_update_date = timezone.now() - timezone.timedelta(days=1)
    start_date = last_update_date.strftime("%Y%m%dT%H:%M-0000")
    end_date = (last_update_date + timezone.timedelta(days=1)).strftime(
        "%Y%m%dT%H:%M-0000"
    )
    load_lmp_from_date_range(start_date, end_date, SubstationLMPMarket.DAM)


# Schedule to run every 30 minutes
@periodic_task(crontab(minute="*/30"))
def load_rtm_lmp():
    last_update_date = get_last_lmp_date(SubstationLMPMarket.RTM_5min)
    if not last_update_date:
        last_update_date = timezone.now() - timezone.timedelta(days=1)
    start_date = last_update_date.strftime("%Y%m%dT%H:%M-0000")
    end_date = (last_update_date + timezone.timedelta(hours=1)).strftime(
        "%Y%m%dT%H:%M-0000"
    )
    load_lmp_from_date_range(start_date, end_date, SubstationLMPMarket.RTM_5min)


# Schedule to run every day at 1:00 AM
@periodic_task(crontab(minute=0, hour=1))
def load_caiso_queue_and_no_of_connections():
    from loaders.caiso_loader import extract_name_voltage

    iso = gridstatus.CAISO()
    resp = iso.get_interconnection_queue()

    if not resp.empty:
        return

    resp["Interconnection Location"] = resp["Interconnection Location"].apply(
        extract_name_voltage
    )

    resp = (
        resp.groupby(["Interconnection Location"])["Capacity (MW)"]
        .agg(total_sum="sum", occurrence_count="size")
        .reset_index()
    )

    for _, row in resp.iterrows():
        name, voltage = row["Interconnection Location"]
        if not name or not voltage:
            continue
        split_name = [x.lower() for x in name.split()]
        split_name = re.split(r"[ -]", name)

        try:
            query = Q()
            for part in split_name:
                query |= Q(name__icontains=part)
            substation = Substation.objects.filter(
                query,
                voltage=voltage,
                interconnecting_entity="CAISO",
                type=SubstationType.DISTRIBUTION,
            ).first()

            if not substation:
                continue

            queue = SubstationQueue.objects.filter(substation=substation)

            if queue.exists():
                queue.update(is_active=False)

            SubstationQueue.objects.create(
                substation=substation,
                queue=row["total_sum"],
                no_of_projects=row["occurrence_count"],
            )
            logger.info(f"CAISO queue for {name} ({voltage} kV) loaded successfully")
        except Exception as e:
            logger.error(f"Error in loading CAISO queue: {e}")


def get_last_date_for_actual_avg_lmp_for_substation(substation):
    last_entry = (
        AverageLMP.objects.filter(substation=substation, type=AverageLMPType.ACTUAL)
        .order_by("-time")
        .first()
    )
    if last_entry:
        return last_entry.time
    return None

# Schedule to run every day at 9:30 AM
@periodic_task(crontab(minute=30, hour=9))
def periodic_calculate_and_save_avg_lmp():
    calculate_and_save_avg_lmp()


def calculate_and_save_avg_lmp(user_last_date=None):
    LAST_DAY_FALLBACK = 100
    today = timezone.now().date()
    previous_day = today - timedelta(days=1)

    for substation in Substation.objects.filter(code__isnull=False):
        last_date = user_last_date or get_last_date_for_actual_avg_lmp_for_substation(
            substation
        )
        if not last_date:
            last_date = previous_day - timedelta(days=LAST_DAY_FALLBACK)
        current_date = last_date + timedelta(days=1)
        while current_date <= previous_day:
            # TODO: Add timezone support in the future for now we are assuming all the dates are in UTC
            # and converting them to PST as we are only supporting CAISO currently
            start_date = current_date.strftime("%Y%m%dT00:00-08:00")
            end_date = current_date.strftime("%Y%m%dT23:59-08:00")
            lmps = list(
                calculate_avg_lmp_from_date_range(substation, start_date, end_date)
            )[0]

            current_date += timedelta(days=1)
            if not lmps:
                continue
            if not lmps["avg_lmp"]:
                continue
            opening_closing_lmp = SubstationLMP.timescale.filter(
                substation=substation,
                time__lte=current_date,
                time__gte=start_date,
            ).order_by("time")
            opening_entry = opening_closing_lmp.first()
            if opening_entry:
                opening_price = (
                    opening_entry.energy + opening_entry.congestion + opening_entry.loss
                )
            else:
                opening_price = 0

            closing_entry = opening_closing_lmp.last()
            if closing_entry:
                closing_price = (
                    closing_entry.energy + closing_entry.congestion + closing_entry.loss
                )
            else:
                closing_price = 0

            AverageLMP.objects.create(
                substation=substation,
                time=start_date,
                energy=lmps["avg_energy"],
                congestion=lmps["avg_congestion"],
                loss=lmps["avg_loss"],
                total_lmp=lmps["avg_lmp"],
                opening_price=opening_price,
                closing_price=closing_price,
                type=AverageLMPType.ACTUAL,
            )
