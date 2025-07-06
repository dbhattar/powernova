import psycopg2
from psycopg2 import errors
import json
import csv
import os
import populate_queue_projects
import sync_typesense

POWERNOVA_DB = os.environ['POWERNOVA_DB']
POWERNOVA_USER = os.environ['POWERNOVA_USER']
POWERNOVA_PASSWORD = os.environ['POWERNOVA_PASSWORD']
POWERNOVA_HOST = os.environ['POWERNOVA_HOST']
POWERNOVA_PORT = os.environ['POWERNOVA_PORT']

def setup_tables(conn):
    with conn.cursor() as cursor:
        cursor.execute("""CREATE TABLE IF NOT EXISTS StateCodes (
                StateCode NUMERIC,
                ShortName VARCHAR(2),
                Name VARCHAR(128),
                PRIMARY KEY (StateCode))""")
        cursor.execute("""CREATE TABLE IF NOT EXISTS LocationCodes (
                Level NUMERIC,
                StateCode NUMERIC,
                CountyCode NUMERIC,
                SubdivisionCode NUMERIC,
                PlaceCode NUMERIC,
                CityCode NUMERIC,
                Name VARCHAR(128),
                PRIMARY KEY (Level, StateCode, CountyCode, SubdivisionCode, PlaceCode, CityCode))""")
        cursor.execute("""CREATE TABLE IF NOT EXISTS QueueInfo (
                IsoID TEXT,
                QueueID TEXT,
                ProjectName TEXT,
                InterconnectingEntity TEXT,
                County TEXT,
                StateName TEXT,
                InterconnectionLocation TEXT,
                TransmissionOwner TEXT,
                GenerationType TEXT,
                CapacityMW NUMERIC,
                SummerCapacity NUMERIC,
                WinterCapacityMW NUMERIC,
                QueueDate DATE,
                Status TEXT,
                ProposedCompletionDate DATE,
                WithdrawnDate DATE,
                WithdrawalComment TEXT,
                ActualCompletionDate DATE,
                AdditionalInfo TEXT,
                PRIMARY KEY (IsoID, QueueID))""")

def add_state_codes(conn, code_file):
    input_file = open (code_file)
    code_obj = json.load(input_file)

    insert_query = """INSERT INTO LocationCodes
        (Level, StateCode, CountyCode, SubdivisionCode, PlaceCode, CityCode, Name) VALUES
        (%s, %s, %s, %s, %s, %s, %s)"""

    with conn.cursor() as cursor:
        for code in code_obj:
            try:
                cursor.execute(insert_query, 
                               (code["Level"], code["StateCode"], code["CountyCode"], code["SubdivisionCode"],
                               code["PlaceCode"], code["CityCode"], code["Name"]))
            except errors.UniqueViolation:
                    #print(f"Skipping row with name={code['Name']} - already exists")
                    conn.rollback()  # Roll back the failed transaction
            except Exception as e:
                    print(f"Something happened: {e}")
                    conn.rollback()
            else:
                conn.commit()  # Commit successful inserts

def get_state_id(conn, state_name):
    select_query = "SELECT StateCode FROM LocationCodes WHERE Level = 40 AND Name = '" + state_name + "'"
    with conn.cursor() as cursor:
        cursor.execute(select_query)
        results = cursor.fetchall()
        if len(results) != 1:
            raise ValueError('State name is invalid')
        return results[0][0]

def add_state_names(conn, state_name_file):
    insert_query = """INSERT INTO StateCodes (StateCode, ShortName, Name) VALUES (%s, %s, %s)"""

    with open(state_name_file, newline='') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            try:
                id = get_state_id(conn, row['State'])
                with conn.cursor() as cursor:
                        cursor.execute(insert_query, 
                                       (id, row['Abbr'], row['State']))
            except errors.UniqueViolation:
                # print(f"Skipping row with name={row['State']} - already exists")
                conn.rollback()  # Roll back the failed transaction
            except Exception as e:
                print(f"Something happened: {row['State']}, {e}")
                conn.rollback()
            else:
                conn.commit()  # Commit successful inserts

def setup_state_data():
    code_file = "/data/gis/state_codes.json"
    state_names = "/data/gis/us_states.csv"

    conn = psycopg2.connect(database=POWERNOVA_DB,
                            host=POWERNOVA_HOST,
                            user=POWERNOVA_USER,
                            password=POWERNOVA_PASSWORD,
                            port=POWERNOVA_PORT)
    print("Setting up the tables")
    setup_tables(conn)
    print("Populating the state codes")
    add_state_codes(conn, code_file)
    print("Populate state names")
    add_state_names(conn, state_names)

    conn.close()

def setup():
    setup_state_data()
    print("Populating the queue information")
    populate_queue_projects.setup_queue_info()
    print("Setting up typesense")
    sync_typesense.setup_typesense()

if __name__ == "__main__":
    print("Import the module to call methods in this module")
