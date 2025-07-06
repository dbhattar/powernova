import psycopg2
from psycopg2 import errors
import gridstatus
import json
import pandas as pd
import numpy as np
import os
import populate_queue_projects

POWERNOVA_DB = os.environ['POWERNOVA_DB']
POWERNOVA_USER = os.environ['POWERNOVA_USER']
POWERNOVA_PASSWORD = os.environ['POWERNOVA_PASSWORD']
POWERNOVA_HOST = os.environ['POWERNOVA_HOST']
POWERNOVA_PORT = os.environ['POWERNOVA_PORT']

def get_db_connection():
    conn = psycopg2.connect(database=POWERNOVA_DB,
                            host=POWERNOVA_HOST,
                            user=POWERNOVA_USER,
                            password=POWERNOVA_PASSWORD,
                            port=POWERNOVA_PORT)
    return conn

def populate_queue_projects(conn, isoId, iso):
    cursor = conn.cursor()

    df = iso.get_interconnection_queue()
    gdf = df.replace({pd.NaT: None, np.nan: None, "TBD": None, " ": None})

    insert_query = """INSERT INTO QueueInfo
        (IsoID, QueueID, ProjectName, InterconnectingEntity, County, StateName,
        InterconnectionLocation, TransmissionOwner, GenerationType, CapacityMW,
        SummerCapacity, WinterCapacityMW, QueueDate, Status, ProposedCompletionDate, 
        WithdrawnDate, WithdrawalComment, ActualCompletionDate, AdditionalInfo) VALUES
        (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"""

    #additionalInfo = json.loads(df.iloc[0][17:].to_json())
    #additionalInfo = json.dumps(additionalInfo)
    #query = stmtfmt.format('CAISO', df.iloc[0][0], df.iloc[0][1], df.iloc[0][2], df.iloc[0][3],
    #        df.iloc[0][4], df.iloc[0][5], df.iloc[0][6], df.iloc[0][7], df.iloc[0][8], df.iloc[0][9],
    #        df.iloc[0][10], df.iloc[0][11], df.iloc[0][12], df.iloc[0][13], df.iloc[0][14],
    #        df.iloc[0][15], df.iloc[0][16], additionalInfo)

    #insert_query = """
    #    INSERT INTO vehicle_tracking (id, timestamp, value, geom)
    #    VALUES (%s, %s, %s, ST_GeomFromText(%s, 4326))
    #"""

    with conn.cursor() as cursor:
        for index, row in gdf.iterrows():
            additionalInfo = json.loads(row[17:].to_json())
            additionalInfo = json.dumps(additionalInfo)
            try:
                cursor.execute(insert_query, (isoId, row.iloc[0], row.iloc[1], row.iloc[2], row.iloc[3],
                        row.iloc[4], row.iloc[5], row.iloc[6], row.iloc[7], row.iloc[8], row.iloc[9],
                        row.iloc[10], row.iloc[11], row.iloc[12], row.iloc[13], row.iloc[14],
                        row.iloc[15], row.iloc[16], additionalInfo))
            except errors.UniqueViolation:
                    # print(f"Skipping row with id={row[0]} for {isoId} - already exists")
                    conn.rollback()  # Roll back the failed transaction
            except Exception as e:
                    print(f"Something happened: {e}")
                    conn.rollback()
            else:
                conn.commit()  # Commit successful inserts

def populate_projects_for(isoId):
    conn = get_db_connection()

    isos = gridstatus.list_isos()
    for index, iso in isos.iterrows():
        isoClassName = iso['Class']
        if isoClassName.upper() == isoId.upper():
            iso_class = getattr(gridstatus, iso['Class'])
            try:
                isoInstance = iso_class()
                print("Populating queues from ", iso['Class'])
                populate_queue_projects(conn, iso['Class'], isoInstance)
                print("Done for ", iso['Class'])
            except ValueError:
                print("Failed")
            break
    conn.close()

def populate_projects_for_all_isos():
    conn = get_db_connection()

    # isone = gridstatus.ISONE()
    # populate_queue_projects(conn, "ISONE", isone)
    isos = gridstatus.list_isos()
    for index, iso in isos.iterrows():
        iso_class = getattr(gridstatus, iso['Class'])
        try:
            isoInstance = iso_class()
            print("Populating queues from ", iso['Class'])
            populate_queue_projects(conn, iso['Class'], isoInstance)
            print("Done for ", iso['Class'])
        except ValueError as err:
            print("Failed: " + err)
        except NotImplementedError as ex:
            print("Exception: " + str(ex))

    conn.close()

def setup_queue_info():
    populate_projects_for_all_isos()

if __name__ == "__main__":
    print("Import the module to call methods in this module")
