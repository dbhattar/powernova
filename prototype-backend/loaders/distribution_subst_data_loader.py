import json

import pandas as pd

from concurrent.futures import ThreadPoolExecutor

from django.contrib.gis.geos import Point

from substation import models

from loaders.utils import print_success
from loaders.utils import remove_sub_from_string

from loaders.caiso_loader import extract_name_voltage


def load_distribution_substations(json_data_path):
    with open(json_data_path, "r") as jsonfile:
        json_data = json.load(jsonfile)

    for substation in json_data:
        county = models.County.objects.get_or_create(
            name=substation["County"], state="CA"
        )[0]
        try:
            models.Substation.objects.create(
                name=substation["Name"],
                voltage=substation["Voltage"],
                county=county,
                geo_coordinates=Point(
                    float(substation["Lon"]), float(substation["Lat"])
                ),
                type=models.SubstationType.DISTRIBUTION,
                utility_area=substation["Owner"],
                interconnecting_entity=substation["Owner"],
            )
            print_success(f"Loaded {substation['Name']}")
        except Exception:
            continue


def create_distribution_substation_queue_for_interconnecting_entity(
    substation_name, queue, no_of_projects, interconnecting_entity="CAISO", voltage=None
):
    try:
        substation, is_created = models.Substation.objects.get_or_create(
            name__icontains=substation_name,
            interconnecting_entity=interconnecting_entity,
            type=models.SubstationType.DISTRIBUTION,
            utility_area=interconnecting_entity,
            defaults={"voltage": voltage},
        )

        if not is_created:
            substation.utility_area = interconnecting_entity
            substation.interconnecting_entity = interconnecting_entity
            substation.save()

        previous_queue = models.SubstationQueue.objects.filter(
            substation=substation, substation__type=models.SubstationType.DISTRIBUTION
        )

        if previous_queue.exists():
            previous_queue.update(is_active=False)

        models.SubstationQueue.objects.create(
            substation=substation,
            queue=queue,
            no_of_projects=no_of_projects,
        )
    except Exception as e:
        raise Exception(f"Failed to create substation queue, {substation_name}, {e}")


def load_pgae_distribution_queue_report(csv_data_path):
    chunksize = 1000
    pgae_chunks = pd.read_csv(csv_data_path, chunksize=chunksize)

    final_results = []

    def process_chunk(chunk):
        grouped = (
            chunk.groupby("Substation")["Summer Max Capacity (MW)"]
            .agg(total_sum="sum", occurrence_count="size")
            .reset_index()
        )
        grouped["Substation"] = grouped["Substation"].apply(remove_sub_from_string)
        return grouped

    with ThreadPoolExecutor(max_workers=4) as executor:
        future_results = [
            executor.submit(process_chunk, chunk) for chunk in pgae_chunks
        ]
        for future in future_results:
            try:
                result = future.result()
                final_results.append(result)
            except Exception as e:
                print(f"Error processing chunk: {e}")

    combined_df = pd.concat(final_results, ignore_index=True)

    consolidated = (
        combined_df.groupby("Substation")
        .agg(
            total_sum=("total_sum", "sum"), occurrence_count=("occurrence_count", "sum")
        )
        .reset_index()
    )

    for _, row in consolidated.iterrows():
        try:
            create_distribution_substation_queue_for_interconnecting_entity(
                row["Substation"], row["total_sum"], row["occurrence_count"], "PG&E"
            )
            print_success(f"Loaded {row['Substation']} queue")
        except Exception as e:
            continue


def load_sdge_distribution_queue_report(csv_data_path):
    import pandas as pd

    sdge_df = pd.read_csv(csv_data_path)
    statuses_to_exclude = ["Withdrawn", "Completed"]

    active_projects = sdge_df[
        ~sdge_df["Application Status"].str.contains(
            "|".join(statuses_to_exclude), na=False, case=False
        )
    ].copy()

    sdge_df = (
        active_projects.groupby(["Substation and Circuit"])
        .agg(
            total_sum=("Summer", "sum"),
            occurrence_count=("Substation and Circuit", "size"),
        )
        .reset_index()
    )

    sdge_df["Substation"] = sdge_df["Substation and Circuit"].str.extract(
        r"^(.*?)\s+Substation"
    )

    for _, row in sdge_df.iterrows():
        try:
            create_distribution_substation_queue_for_interconnecting_entity(
                row["Substation"], row["total_sum"], row["occurrence_count"], "SDG&E"
            )
            print_success(f"Loaded {row['Substation']} queue")
        except Exception as e:
            print(e)
            continue


def load_sce_distribution_queue_report(csv_data_path):
    sce_df = pd.read_csv(csv_data_path)
    statuses_to_exclude = [
        "Withdrawn",
        "Transferred to Rule 21",
        "In-Service",
        "In-Service (Conditional PTO)",
        "On Hold",
        "Pending",
        "Pending-Withdrawn",
    ]
    active_projects = sce_df[
        ~sce_df["Current Phase"].str.contains(
            "|".join(statuses_to_exclude), na=False, case=False
        )
    ]
    sce_df = (
        active_projects.groupby(["Current Point of Interconnection"])[
            "Facility Max Export Req(MW)"
        ]
        .agg(total_sum="sum", occurrence_count="size")
        .reset_index()
    )
    sce_df["Current Point of Interconnection"] = sce_df[
        "Current Point of Interconnection"
    ].apply(extract_name_voltage)

    for _, row in sce_df.iterrows():
        try:
            name, voltage = row["Current Point of Interconnection"]
            if not name or not voltage:
                continue
            create_distribution_substation_queue_for_interconnecting_entity(
                name,
                row["total_sum"],
                row["occurrence_count"],
                "SCE",
                voltage,
            )
            print_success(f"Loaded {name} queue")
        except Exception:
            continue


# def get_sce_name_voltage_from_sub_id(sub_id):
#     if not sub_id:
#         return None, None
#     pattern = r"^([^\d/]+)\s.*?\/(\d+)"
#     match = re.match(pattern, sub_id)
#     if match:
#         return (match.group(1), match.group(2))
#     return None, None


# def load_sce_distribution_queue_report(csv_data_path):
#     sce_df = pd.read_csv(csv_data_path)
#     statuses_to_exclude = [
#         "Withdrawn",
#         "Transferred to Rule 21",
#         "In-Service",
#         "In-Service (Conditional PTO)",
#         "On Hold",
#         "Pending",
#         "Pending-Withdrawn",
#     ]
#     active_projects = sce_df[
#         ~sce_df["Current Phase"].str.contains(
#             "|".join(statuses_to_exclude), na=False, case=False
#         )
#     ]
#     sce_df = (
#         active_projects.groupby(["Substation ID"])["Facility Max Export Req(MW)"]
#         .agg(total_sum="sum", occurrence_count="size")
#         .reset_index()
#     )
#     sce_df["Substation ID"] = sce_df["Substation ID"].apply(
#         get_sce_name_voltage_from_sub_id
#     )

#     for _, row in sce_df.iterrows():
#         try:
#             name, voltage = row["Substation ID"]
#             if not name or not voltage:
#                 continue
#             create_distribution_substation_queue_for_interconnecting_entity(
#                 name,
#                 row["total_sum"],
#                 row["occurrence_count"],
#                 "SCE",
#                 voltage,
#             )
#             print_success(f"Loaded {name} queue")
#         except Exception:
#             continue
