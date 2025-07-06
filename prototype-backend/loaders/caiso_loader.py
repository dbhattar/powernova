import re
import json
import gridstatus
import gridmonitor
import pandas as pd

from django.db.models import Q
from django.db import transaction
from django.contrib.gis.geos import Point, LineString

from substation import models

from loaders.utils import print_success
from loaders.utils import print_warning


def extract_name_voltage(row):
    match = re.search(r"(.+?)\s+(\d+)\s*kV", row)
    if match:
        name = match.group(1).strip()
        voltage = int(match.group(2))
        return name, voltage
    return None, None


def load_substations(csv_path: str | None):
    if not csv_path:
        print_warning("No CSV file provided")
        return
    df = pd.read_csv(csv_path)
    for _, row in df.iterrows():
        try:
            with transaction.atomic():
                name, voltage = extract_name_voltage(row["NAME"])
                models.Substation.objects.create(
                    name=name,
                    voltage=voltage,
                    study_region=row["Study Area"],
                    utility_area=row["Owner"],
                    interconnecting_entity="CAISO",
                )
                print_success(f"Substation {name} ({voltage} kV) created successfully")
        except Exception as e:
            print_warning(f"Error creating substation {name} ({voltage} kV): {e}")


def load_substation_county_and_location(json_path: str | None):
    if not json_path:
        print_warning("No JSON file provided")
        return
    with open(json_path) as f:
        data = json.load(f)

    def build_substation_data_index(features):

        index = {}
        for feature in features:
            max_voltage = feature["properties"].get("Max_Voltag")
            name = feature["properties"].get("Name")
            if max_voltage is not None and name is not None:
                key = (name, float(max_voltage))
                index[key] = {
                    "county": (
                        re.sub(
                            r"\s*County$", "", feature["properties"]["COUNTY"]
                        ).title()
                        if feature["properties"]["COUNTY"]
                        else None
                    ),
                    "location": [
                        feature["properties"]["Lat"],
                        feature["properties"]["Lon"],
                    ],
                }
        return index

    substation_data_index = build_substation_data_index(data["features"])

    for key, value in substation_data_index.items():
        name, voltage = key
        county = value["county"]
        location = value["location"]
        try:
            with transaction.atomic():
                substation = models.Substation.objects.filter(
                    name__icontains=name, voltage=voltage
                ).first()
                if not substation:
                    continue
                substation.county = models.County.objects.get_or_create(name=county)[0]
                substation.geo_coordinates = Point(location[1], location[0])
                substation.save()
                print_success(
                    f"Substation {name} ({voltage} kV) updated with county and location"
                )
        except Exception as e:
            print_warning(
                f"Error updating substation {name} ({voltage} kV) with county and location: {e}"
            )


def load_avaliablecapacity_and_no_of_constraints_from_heatmap():
    iso = gridmonitor.CAISO()
    resp = iso.get_raw_heatmap_data()
    if resp is None:
        print_warning("No data found in heatmap")
        return

    buses = pd.DataFrame(resp["wcResults"][0]["buses"])
    flow_gates = pd.DataFrame(resp["wcResults"][0]["flowgates"])
    merged_df = pd.merge(
        buses[["id", "busname", "trlim"]],
        flow_gates[["busid", "mon"]],
        left_on="id",
        right_on="busid",
    )
    result = (
        merged_df.groupby(["busname", "trlim"])["mon"]
        .nunique()
        .reset_index(name="unique_mon_count")
    )
    for _, row in result.iterrows():
        name, voltage = extract_name_voltage(row["busname"])
        if not name or not voltage:
            continue
        try:
            with transaction.atomic():
                substation = models.Substation.objects.filter(
                    name__icontains=name, voltage=voltage
                ).first()
                if not substation:
                    continue
                models.SubstationStatus.objects.create(
                    substation=substation,
                    available_capacity=row["trlim"],
                    no_of_constraints=row["unique_mon_count"],
                    type=models.DatasourceType.HEATMAP,
                )
                print_success(
                    f"Substation constraint for {name} ({voltage} kV) created successfully"
                )
        except Exception as e:
            print_warning(
                f"Error creating substation constraint for {name} ({voltage} kV): {e}"
            )


def load_policy_portfolio(csv_path: str | None):
    if not csv_path:
        print_warning("No CSV file provided")
        return
    df = pd.read_csv(csv_path)
    for _, row in df.iterrows():
        name = row["Substation"]
        voltage = row["Voltage"]
        try:
            with transaction.atomic():
                if not name or not voltage:
                    continue
                substation = models.Substation.objects.filter(
                    name__icontains=name, voltage=voltage
                ).first()
                if not substation:
                    continue
                models.SubstationPolicyPortfolio.objects.create(
                    substation=substation,
                    policy_portfolio=row["Portfolio MW"],
                    year=2024,
                )
                print_success(
                    f"Substation status for {name} ({voltage} kV) created successfully"
                )
        except Exception as e:
            print_warning(
                f"Error creating substation status for {name} ({voltage} kV): {e}"
            )


def load_queue_and_no_of_connections():
    iso = gridstatus.CAISO()
    resp = iso.get_interconnection_queue()
    if resp.empty:
        print_warning("No data found in interconnection queue")
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
            with transaction.atomic():
                if not name or not voltage:
                    continue

                query = Q()
                for term in split_name:
                    query |= Q(name__icontains=term)
                substation = models.Substation.objects.filter(
                    query, voltage=voltage
                ).first()

                if not substation:
                    continue
                substation_queue = models.SubstationQueue.objects.filter(
                    substation=substation
                )
                queue = row["total_sum"]
                no_of_projects = row["occurrence_count"]

                if substation_queue.exists():
                    sub_queue = substation_queue.first()
                    queue = (
                        sub_queue.queue + row["total_sum"]
                        if sub_queue.queue
                        else row["total_sum"]
                    )
                    no_of_projects = (
                        sub_queue.no_of_projects + row["occurrence_count"]
                        if sub_queue.no_of_projects
                        else row["occurrence_count"]
                    )

                    substation_queue.update(
                        queue=queue,
                        no_of_projects=no_of_projects,
                    )
                    print_success(
                        f"Substation queue for {name} ({voltage} kV) updated successfully"
                    )
                else:
                    models.SubstationQueue.objects.create(
                        substation=substation,
                        queue=row["total_sum"],
                        no_of_projects=row["occurrence_count"],
                    )
                    print_success(
                        f"Substation queue for {name} ({voltage} kV) created successfully"
                    )

                print_success(
                    f"Substation queue for {name} ({voltage} kV) created successfully"
                )
        except Exception as e:
            print_warning(
                f"Error creating substation queue for {name} ({voltage} kV): {e}"
            )


def load_constraints_from_constraint_report(csv_path: str | None):
    if not csv_path:
        print_warning("No CSV file provided")
        return
    df = pd.read_csv(csv_path)
    for _, row in df.iterrows():
        name, voltage = extract_name_voltage(row["POI"])
        if not name or not voltage:
            continue
        try:
            with transaction.atomic():
                substation = models.Substation.objects.filter(
                    name__icontains=name, voltage=voltage
                ).first()
                if not substation:
                    continue
                models.SubstationStatus.objects.create(
                    substation=substation,
                    available_capacity=row["Minimum TPD"],
                    no_of_constraints=row["No of Constraints"],
                    type=models.DatasourceType.CONSTRAINT,
                )
                print_success(
                    f"Substation constraint for {name} ({voltage} kV) created successfully"
                )
        except Exception as e:
            print_warning(
                f"Error creating substation constraint for {name} ({voltage} kV): {e}"
            )


def load_lmp_and_substation_code(json_data_path: str):
    if not json_data_path:
        print_warning("No JSON file provided")
        return

    with open(json_data_path) as f:
        data = json.load(f)

    def build_lmp_data_index(data):
        index = {}
        for item in data:
            index[item["Name"]] = {
                "id": item["POI_ID"],
                "dg": item["dg"],
                "dc": item["dc"],
                "dl": item["dl"],
            }
        return index

    lmp_data_index = build_lmp_data_index(data)

    for key, value in lmp_data_index.items():
        name = key
        if not name:
            continue
        try:
            with transaction.atomic():
                substations = models.Substation.objects.filter(
                    name__icontains=name
                ).distinct("id")
                if not substations.exists():
                    continue
                if value["id"]:
                    for substation in substations:
                        substation.code = value["id"]
                        substation.save()
                for substation in substations:
                    models.SubstationLMP.objects.create(
                        substation=substation,
                        energy=float(value["dg"]),
                        congestion=float(value["dc"]),
                        loss=float(value["dl"]),
                        time="2023-01-01T00:00:00Z",
                    )
                print_success(f"Substation LMP for {name} created successfully")
        except Exception as e:
            print_warning(f"Error creating substation LMP for {name}: {e}")


def load_lmp_from_date_range(start_date: str, end_date: str):
    iso = gridstatus.CAISO()
    for date in pd.date_range(start=start_date, end=end_date):
        lmp_data = iso.get_lmp(
            locations="all",
            market=gridstatus.Markets.DAY_AHEAD_HOURLY,
            date=date.strftime("%Y-%m-%d"),
            end=(date + pd.Timedelta(days=1)).strftime("%Y-%m-%d"),
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
                )
                print_success(
                    f"Substation LMP for {substation.name} created successfully"
                )
            except Exception as e:
                print_warning(
                    f"Error creating substation LMP: {row['Location']} ({row['Time']}): {e}"
                )


def load_transmission_lines(json_data_path: str):
    if not json_data_path:
        print_warning("No JSON file provided")
        return

    with open(json_data_path) as f:
        data = json.load(f)

    for item in data.get("features", []):
        properties = item.get("properties")
        tline = (
            properties.get("TLine_Name").strip() if properties.get("TLine_Name") else ""
        )
        name = tline if tline else properties.get("Name")
        voltage = properties.get("kV_Sort")
        if not name or not voltage:
            continue
        try:
            with transaction.atomic():
                models.TransmissionLine.objects.create(
                    name=name,
                    voltage=voltage,
                    utility_area=properties.get("Owner"),
                    circuit=properties.get("Circuit"),
                    type=properties.get("Type"),
                    geo_coordinates=LineString(item.get("geometry").get("coordinates")),
                )
                print_success(
                    f"Transmission line {name} ({voltage} kV) created successfully"
                )
        except Exception as e:
            print_warning(
                f"Error creating transmission line {name} ({voltage} kV): {e}"
            )


def load_all_data(
    substation_csv_path: str | None,
    substation_county_location_json_path: str | None,
    heatmap_constraints: bool,
    policy_portfolio_csv_path: str | None,
    interconnection_queue: bool,
    constraint_report_csv_path: str | None,
):
    if substation_csv_path:
        load_substations(substation_csv_path)
    if substation_county_location_json_path:
        load_substation_county_and_location(substation_county_location_json_path)
    if heatmap_constraints:
        load_avaliablecapacity_and_no_of_constraints_from_heatmap()
    if policy_portfolio_csv_path:
        load_policy_portfolio(policy_portfolio_csv_path)
    if interconnection_queue:
        load_queue_and_no_of_connections()
    if constraint_report_csv_path:
        load_constraints_from_constraint_report(constraint_report_csv_path)


def load_transmission_substation(json_data_path: str):
    # Load IID, SMUD and LADWP transmission_data

    if not json_data_path:
        print_warning("No JSON file provided")
        return

    with open(json_data_path) as f:
        data = json.load(f)

    for item in data:
        name = item.get("Substation Name")
        voltage = item.get("Voltage")
        if not name or not voltage:
            print(name, voltage)
            continue
        county = item["County"]
        county, _ = models.County.objects.get_or_create(name=county, state="CA")
        try:
            with transaction.atomic():
                models.Substation.objects.create(
                    name=name,
                    voltage=voltage,
                    utility_area=item["Owner"],
                    county=county,
                    geo_coordinates=Point(float(item["Lon"]), float(item["Lat"])),
                    type=models.SubstationType.TRANSMISSION,
                    interconnecting_entity=item["Owner"],
                )
                print_success(f"Substation {name} ({voltage} kV) created successfully")
        except Exception as e:
            print_warning(f"Error creating substation {name} ({voltage} kV): {e}")


def load_transmission_queue_report(queue_json: str):
    if not queue_json:
        print_warning("No JSON file provided")
        return

    with open(queue_json) as f:
        data = json.load(f)

    for sub_name, sub_data in data.items():
        if not sub_name or not sub_data:
            continue

        try:
            with transaction.atomic():
                substation = models.Substation.objects.filter(
                    name__icontains=sub_name, voltage=sub_data["Voltage"]
                ).first()
                if not substation:
                    continue
                prev_q = models.SubstationQueue.objects.filter(substation=substation)
                if prev_q.exists():
                    prev_q.update(
                        is_active=False,
                    )
                models.SubstationQueue.objects.create(
                    substation=substation,
                    queue=sub_data["Total"],
                    no_of_projects=sub_data["Occurrences"],
                    is_active=True,
                )
                print_success(
                    f"Substation queue for {sub_name} ({sub_data['Voltage']} kV) created successfully"
                )
        except Exception as e:
            print_warning(
                f"Error creating substation queue for {sub_name} ({sub_data['Voltage']} kV): {e}"
            )
