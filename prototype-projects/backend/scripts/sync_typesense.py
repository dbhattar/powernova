import typesense
import psycopg2
import os

POWERNOVA_DB = os.environ['POWERNOVA_DB']
POWERNOVA_USER = os.environ['POWERNOVA_USER']
POWERNOVA_PASSWORD = os.environ['POWERNOVA_PASSWORD']
POWERNOVA_HOST = os.environ['POWERNOVA_HOST']
POWERNOVA_PORT = os.environ['POWERNOVA_PORT']
TYPESENSE_HOST=os.environ['TYPESENSE_HOST']
TYPESENSE_PORT=os.environ['TYPESENSE_PORT']
TYPESENSE_PROTOCOL=os.environ['TYPESENSE_PROTOCOL']
TYPESENSE_API_KEY=os.environ['TYPESENSE_API_KEY']

typesenseClient = typesense.Client({
    'api_key': 'xyz',
    'nodes': [{
        'host': TYPESENSE_HOST,
        'port': TYPESENSE_PORT,
        'protocol': TYPESENSE_PROTOCOL
    }],
    'connection_timeout_seconds': 2
})


def get_db_connection():
    conn = psycopg2.connect(database=POWERNOVA_DB,
                            host=POWERNOVA_HOST,
                            user=POWERNOVA_USER,
                            password=POWERNOVA_PASSWORD,
                            port=POWERNOVA_PORT)
    return conn


# Define the Typesense collection schema
schema = {
    "name": 'projects',
    "fields": [
        { "name": 'iso', "type": 'string' },
        { "name": 'queueid', "type": 'string'},
        { "name": 'county', "type": 'string' },
        { "name": 'state', "type": 'string' },
        { "name": 'gentype', "type": 'string' },
        { "name": 'description', "type": 'string' }
    ]
}

projects_schema = {
    "name": 'projects',
    "fields": [
        { 
            "name": 'iso', 
            "type": 'string' 
        }, { 
            "name": 'queueid', 
            "type": 'string'
        }, { 
            "name": 'county', 
            "type": 'string' 
        }, { 
            "name": 'state', 
            "type": 'string' 
        }, { 
            "name": 'gentype', 
            "type": 'string' 
        }, { 
            "name": 'description', 
            "type": 'string' 
        },
        {
            "name" : "embedding",
            "type" : "float[]",
            "embed": {
                "from": [ "iso", "queueid", "county", "state", "gentype", "description"],
                "model_config": {
                    "model_name": "ts/e5-small"
                }
            }
        }
    ]
}


# Define the Typesense collection schema
update_schema = {
    "fields": [
        { "name": 'queueid', type: 'string'}
    ]
}

def updateCollection(name):
    typesenseClient.collections[name].update(update_schema)
    print('Collection schema updated successfully!')

def dropCollection(name):
    typesenseClient.collections[name].delete()
    print('Collection deleted successfully!')

def syncData(name):
    try:
        #Create or update the collection
        #Create or update the collection
        already_exists = False
        try:
            typesenseClient.collections.create(projects_schema)
        except typesense.exceptions.ObjectAlreadyExists as err:
            print("Collection already exists. Continuing to sync data")
            already_exists = True
        if not already_exists:
            print("Successfully created the collection")
        print("Successfully created the collection")
        # Fetch data from PostgreSQL
        q = "SELECT IsoID, QueueId, County, StateName, GenerationType, AdditionalInfo FROM QueueInfo"
        conn = get_db_connection()
        print("Successfully connected to database")
        cursor = conn.cursor()
        print("Got the cursor")
        cursor.execute(q)
        print("Successfully executed the query")
        results = cursor.fetchall()
        print("Successfully fetched the results")
        docs = typesenseClient.collections[name].documents
        for (isoid, queueid, county, state_name, gentype, desc) in results:
            #print(isoid, ", ", queueid, ", ", county, ", ", state_name, ", ", gentype, ", ", desc)
            #break
            docs.upsert({
                "iso": str(isoid), #Typesense requires string IDs
                "queueid": str(queueid),
                "county": str(county),
                "state": str(state_name),
                "gentype": str(gentype),
                "description": str(desc)
            })
        # Import data into Typesense
            #typesenseClient.collections[name].documents.upsert(docs) 
        print('Data synced successfully!')
    except Exception as e:
        print('Error syncing data:', e)
#    finally:
#        await conn.close()

def import_project_data():
    try:
        collection_name = projects_schema["name"]
        #Create or update the collection
        already_exists = False
        try:
            typesenseClient.collections.create(projects_schema)
        except typesense.exceptions.ObjectAlreadyExists as err:
            print("Collection already exists. Continuing to sync data")
            already_exists = True
        if not already_exists:
            print("Successfully created the collection")
        
        # Fetch data from PostgreSQL
        q = "SELECT IsoID, QueueId, County, StateName, GenerationType, AdditionalInfo FROM QueueInfo"
        conn = get_db_connection()
        print("Successfully connected to database")
        cursor = conn.cursor()
        print("Got the cursor")
        cursor.execute(q)
        print("Successfully executed the query")
        results = cursor.fetchall()
        print("Successfully fetched the results")
        docs = typesenseClient.collections[collection_name].documents
        for (isoid, queueid, county, state_name, gentype, desc) in results:
            #print(isoid, ", ", queueid, ", ", county, ", ", state_name, ", ", gentype, ", ", desc)
            #break
            docs.upsert({
                "iso": str(isoid), #Typesense requires string IDs
                "queueid": str(queueid),
                "county": str(county),
                "state": str(state_name),
                "gentype": str(gentype),
                "description": str(desc)
            })
        # Import data into Typesense
            #typesenseClient.collections[name].documents.upsert(docs) 
        print('Data synced successfully!')
    except Exception as e:
        print('Error syncing data:', e)
#    finally:
#        await conn.close()

def setup_typesense():
    try:
        dropCollection(projects_schema["name"])
    except typesense.exceptions.ObjectNotFound as err:
        print("Collection does not exist. Continuing to import data")
    import_project_data()

if __name__ == "__main__":
    print("Import this module to invoke the method")