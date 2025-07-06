from typing import Union

from fastapi import FastAPI, File, UploadFile, HTTPException,BackgroundTasks, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
import typesense

import psycopg2

import shutil
import os
import ollama
import json

import decimal
import datetime
import time
# import uuid
# import sqlite3
from datetime import datetime, timedelta
import asyncio

import hashlib
import jwt
import asyncpg
from contextlib import asynccontextmanager

# Database configuration
AUTH_DB=os.environ['AUTH_DB']
POWERNOVA_DB = os.environ['POWERNOVA_DB']
POWERNOVA_USER = os.environ['POWERNOVA_USER']
POWERNOVA_PASSWORD = os.environ['POWERNOVA_PASSWORD']
POWERNOVA_HOST = os.environ['POWERNOVA_HOST']
POWERNOVA_PORT = os.environ['POWERNOVA_PORT']
AUTH_DB_URL="postgresql://" + POWERNOVA_USER + ":" + POWERNOVA_PASSWORD + "@" + POWERNOVA_HOST + ":" + POWERNOVA_PORT  + "/" + AUTH_DB

TYPESENSE_HOST=os.environ['TYPESENSE_HOST']
TYPESENSE_PORT=os.environ['TYPESENSE_PORT']
TYPESENSE_PROTOCOL=os.environ['TYPESENSE_PROTOCOL']
TYPESENSE_API_KEY=os.environ['TYPESENSE_API_KEY']

# Secret key for JWT
SECRET_KEY = "your-secret-key"
ALGORITHM = "HS256"

class User(BaseModel):
    email: str
    password: str

# Database connection pool
db_pool = None

app = FastAPI()
db_dir = "../db"
jobs_db = db_dir + "/jobs.db"

docs_dir = "../docs"
data_dir = "/data"
model_name = 'gemma3:4b'

# Directory to save uploaded files
UPLOAD_DIR = "../uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)  # Create directory if it doesn't exist

state_codes = None
county_map = None
iso_rto_map = None
result_header = """
{
    "type": "FeatureCollection",
    "name": "RTO_Regions",
    "crs": {
        "type": "name",
        "properties": {
            "name": "urn:ogc:def:crs:OGC:1.3:CRS84"
        }
    },
    "features": []
}
"""

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://localhost:\d+",  # Matches localhost with any port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CustomEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, decimal.Decimal):
            return str(o)
        elif isinstance(o, (datetime.date, datetime.datetime)):
            return o.isoformat()
        return super().default(o)

@app.get("/api/")
def read_root():
    return {"Hello": "World"}

@app.get("/api/get_state/{state_id}")
def get_state(state_id: int, county_id: Union[int, None] = None):
    global state_codes
    if not state_codes:
        with open(data_dir + "/gis/state_codes.json") as f:
            codes = f.read()
            state_codes = json.loads(codes)
    for obj in state_codes:
        if not county_id or county_id == 0:
            if obj["StateCode"] == state_id and obj["CountyCode"] == 0:
                return {
                    "state_name": obj["Name"]
                }
        else:
            if obj["StateCode"] == state_id and obj["CountyCode"] == county_id:
                return {
                    "county_name": obj["Name"]
                }

    return {
        "error": "Not found"
    }

@app.get("/api/get_county_map")
def get_county_map():
    global county_map
    if not county_map:
        print("loading the map")
        with open(data_dir + "/gis/cb_2018_us_county_500k/us_county.json") as f:
            cmap = f.read()
            county_map = json.loads(cmap)
        print ("done loading")
    return county_map

@app.get("/api/get_rto_iso_map")
def get_rto_iso_map():
    global iso_rto_map
    if not iso_rto_map:
        print("loading the map")
        with open(data_dir + "/gis/RTO_Regions.geojson") as f:
            cmap = f.read()
            iso_rto_map = json.loads(cmap)
        print ("done loading")
    return iso_rto_map

@app.get("/api/get_rto_iso_map/{rto_iso}")
def get_rto_iso_map(rto_iso: str):
    global iso_rto_map, result_header
    if not iso_rto_map:
        print("loading the map")
        with open(data_dir + "/gis/RTO_Regions.geojson") as f:
            cmap = f.read()
            iso_rto_map = json.loads(cmap)
        print ("done loading")

    result = json.loads(result_header)
    result['name'] = rto_iso
    for obj in iso_rto_map['features']:
        if obj['properties']['RTO_ISO'].lower() == rto_iso.lower():
    #           print(obj['properties']['NAME'], obj['geometry']['type'], len(obj['geometry']['coordinates']))
            result['features'].append(obj)
    return result

@app.get("/api/get_project_description")
def read_item(name: Union[str, None] = None):
    name_stripped = ''.join(c for c in name if c.isalnum())
    file_path = docs_dir + "/" + name_stripped + "/description.md"

    desc = ""

    if os.path.exists(file_path):
        with open(file_path, "r") as f:
            desc = f.read()
    else:
        content = "Tell me about " + name + ". It is a power generation project currently in the CAISO interconnection queue. You should generate just the description without any additional comment."
        response = ollama.chat(model=model_name, messages=[
            {
                'role': 'user',
                'content': content,
            },
        ])
        desc = response['message']['content']
        with open(file_path, "w") as f:
            f.write(desc)

    return {
        "name": name,
        "description": desc
    }

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        # Define the file path
        file_path = os.path.join(UPLOAD_DIR, file.filename)

        # Save the file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        return JSONResponse(
            status_code=200,
            content={"message": f"File '{file.filename}' uploaded successfully!"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")
    finally:
        file.file.close()  # Ensure the file is closed

@app.get("/api/get_projects/{iso}")
async def get_projects(iso: str, offset: Union[int, None] = 0, limit: Union[int, None] = 10):
    return get_project_internal(iso, offset, limit)

@app.get("/api/get_projects")
async def get_projects(iso: Union[str, None] = None, offset: Union[int, None] = 0, limit: Union[int, None] = 10):
    return get_project_internal(iso, offset, limit)

@app.get("/api/get_project_details")
async def get_project_detail(isoId: Union[str, None] = None, queueId: Union[str, None] = None):
    return get_project_details_internal(isoId, queueId)

def get_project_internal(iso: str, offset: int, limit: int):
    with psycopg2.connect(database=POWERNOVA_DB,
                            host=POWERNOVA_HOST,
                            user=POWERNOVA_USER,
                            password=POWERNOVA_PASSWORD,
                            port=POWERNOVA_PORT) as conn:
        with conn.cursor() as cursor:
            cursor = conn.cursor()
            if not iso:
                cursor.execute("SELECT COUNT(*) FROM QueueInfo WHERE upper(Status) = 'ACTIVE'")
            else:
                cursor.execute("SELECT COUNT(*) FROM QueueInfo WHERE upper(Status) = 'ACTIVE' AND IsoID = '" + iso + "'")

            count = cursor.fetchone()
            count = count[0]
            if not iso:
                stmt = "SELECT * FROM QueueInfo WHERE upper(Status) = 'ACTIVE' LIMIT " + str(limit) + " OFFSET " + str(offset)
            else:
                stmt = "SELECT * FROM QueueInfo WHERE upper(Status) = 'ACTIVE' AND IsoID = '" + iso + "' LIMIT " + str(limit) + " OFFSET " + str(offset)
            cursor.execute(stmt)

            results = cursor.fetchall()
                
            jobjs = []

            for row in results:
                obj = { 
                    "IsoID": row[0],
                    "QueueID": row[1],
                    "ProjectName": row[2],
                    "InterconnectingEntity": row[3],
                    "County": row[4],
                    "StateName": row[5],
                    "InterconnectionLocation": row[6],
                    "TransmissionOwner": row[7],
                    "GenerationType": row[8],
                    "CapacityMW": row[9],
                    "SummerCapacity": row[10],
                    "WinterCapacityMW": row[11],
                    "QueueDate": row[12],
                    "Status": row[13],
                    "ProposedCompletionDate": row[14],
                    "WithdrawnDate": row[15],
                    "WithdrawalComment": row[16],
                    "ActualCompletionDate": row[17],
                    "AdditionalInfo": row[18]
                }
                jobjs.append(obj)

            return {
                "count": count,
                "results": jobjs
            }

def get_project_details_internal(isoId: str, queueId: str):
    with psycopg2.connect(database=POWERNOVA_DB,
                            host=POWERNOVA_HOST,
                            user=POWERNOVA_USER,
                            password=POWERNOVA_PASSWORD,
                            port=POWERNOVA_PORT) as conn:
        with conn.cursor() as cursor:
            cursor = conn.cursor()
            stmt = "SELECT * FROM QueueInfo WHERE IsoId = '" + isoId + "' AND QueueId='" + queueId + "'"
            cursor.execute(stmt)

            row = cursor.fetchone()
                
            obj = { 
                "IsoID": row[0],
                "QueueID": row[1],
                "ProjectName": row[2],
                "InterconnectingEntity": row[3],
                "County": row[4],
                "StateName": row[5],
                "InterconnectionLocation": row[6],
                "TransmissionOwner": row[7],
                "GenerationType": row[8],
                "CapacityMW": row[9],
                "SummerCapacity": row[10],
                "WinterCapacityMW": row[11],
                "QueueDate": row[12],
                "Status": row[13],
                "ProposedCompletionDate": row[14],
                "WithdrawnDate": row[15],
                "WithdrawalComment": row[16],
                "ActualCompletionDate": row[17],
                "AdditionalInfo": row[18]
            }

            return obj

# # Initialize SQLite database
# def init_db():
#     conn = sqlite3.connect(jobs_db)
#     c = conn.cursor()
#     c.execute('''CREATE TABLE IF NOT EXISTS jobs (
#         job_id TEXT PRIMARY KEY,
#         task TEXT,
#         status TEXT,
#         created_at TEXT,
#         updated_at TEXT,
#         result TEXT
#     )''')
#     conn.commit()
#     conn.close()

# init_db()

# class Job(BaseModel):
#     task: str

# def process_job(job_id: str, task: str):
#     """Simulate a long-running task"""
#     conn = sqlite3.connect(jobs_db)
#     c = conn.cursor()
#     c.execute("UPDATE jobs SET status = ?, updated_at = ? WHERE job_id = ?", 
#               ("running", datetime.now().isoformat(), job_id))
#     conn.commit()
#     conn.close()
    
#     time.sleep(5)  # Simulate work
    
#     conn = sqlite3.connect(jobs_db)
#     c = conn.cursor()
#     c.execute("UPDATE jobs SET status = ?, updated_at = ?, result = ? WHERE job_id = ?", 
#               ("completed", datetime.now().isoformat(), f"{task} finished", job_id))
#     conn.commit()
#     conn.close()

# async def cleanup_old_jobs():
#     """Remove completed jobs older than 24 hours"""
#     while True:
#         conn = sqlite3.connect(jobs_db)
#         c = conn.cursor()
#         threshold = (datetime.now() - timedelta(days=1)).isoformat()
#         c.execute("DELETE FROM jobs WHERE status = ? AND updated_at < ?", ("completed", threshold))
#         conn.commit()
#         conn.close()
#         await asyncio.sleep(3600)  # Check every hour

@app.on_event("startup")
async def startup_event():
    # asyncio.create_task(cleanup_old_jobs())

    global db_pool
    db_pool = await asyncpg.create_pool(AUTH_DB_URL)
    
    # Create users table if it doesn't exist
    async with get_db() as conn:
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL
            )
        ''')
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS SIGNED_UP_EMAILS (
                ID SERIAL PRIMARY KEY,
                NAME TEXT,
                EMAIL TEXT UNIQUE NOT NULL,
                SIGNUP_DATE TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

@app.on_event("shutdown")
async def shutdown_event():
    await db_pool.close()

# @app.post("/api/submit-job/")
# async def submit_job(job: Job, background_tasks: BackgroundTasks):
#     job_id = str(uuid.uuid4())
#     conn = sqlite3.connect(jobs_db)
#     c = conn.cursor()
#     now = datetime.now().isoformat()
#     c.execute("INSERT INTO jobs (job_id, task, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
#               (job_id, job.task, "pending", now, now))
#     conn.commit()
#     conn.close()
    
#     background_tasks.add_task(process_job, job_id, job.task)
#     return {"job_id": job_id}

# @app.get("/api/job-status/{job_id}")
# async def get_job_status(job_id: str):
#     conn = sqlite3.connect(jobs_db)
#     c = conn.cursor()
#     c.execute("SELECT status, task, result FROM jobs WHERE job_id = ?", (job_id,))
#     row = c.fetchone()
#     conn.close()
    
#     if row:
#         return {"status": row[0], "task": row[1], "result": row[2]}
#     return {"status": "not found"}

@asynccontextmanager
async def get_db():
    conn = await db_pool.acquire()
    try:
        yield conn
    finally:
        await db_pool.release(conn)

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def create_access_token(data: dict, expires_delta: timedelta):
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

@app.post("/api/signup")
async def signup(user: User):
    async with get_db() as conn:
        # Check if email already exists
        existing_user = await conn.fetchrow(
            "SELECT * FROM users WHERE email = $1", user.email
        )
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        hashed_password = hash_password(user.password)
        await conn.execute(
            "INSERT INTO users (email, hashed_password) VALUES ($1, $2)",
            user.email, hashed_password
        )
    return {"message": "User created successfully"}

@app.post("/api/signin")
async def signin(user: User):
    async with get_db() as conn:
        db_user = await conn.fetchrow(
            "SELECT * FROM users WHERE email = $1", user.email
        )
        
        if not db_user:
            raise HTTPException(status_code=400, detail="Invalid credentials")
        
        hashed_password = hash_password(user.password)
        if db_user["hashed_password"] != hashed_password:
            raise HTTPException(status_code=400, detail="Invalid credentials")
        
        access_token_expires = timedelta(minutes=30)
        access_token = create_access_token(
            data={"sub": user.email},
            expires_delta=access_token_expires
        )
        return {"access_token": access_token, "token_type": "bearer"}
    

class EmailSignup(BaseModel):
    name: str
    email: EmailStr

@app.post("/api/waitlist_signup")
async def signup(data: EmailSignup):
    async with get_db() as conn:
        await conn.execute("INSERT INTO signed_up_emails (name, email) VALUES ($1, $2) ON CONFLICT DO NOTHING", data.name, data.email)
        await conn.close()
        return {"message": "Thank you for signing up! We’ll notify you soon."}

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

@app.get("/api/search")
async def search_projects(query: Union[str, None] = None, page: Union[int, None] = 1, per_page: Union[int, None] = 10):
    if query == None:
        return {
            "error": "Please specify a search query"
        }
    
    search_parameters = {
        'q'         : query,
        'query_by'  : 'iso,queueid,gentype,county,state,description',
        'page'      : page,
        'per_page'  : per_page
    }
    client = typesense.Client({
        'api_key': TYPESENSE_API_KEY,
        'nodes': [{
            'host': TYPESENSE_HOST,
            'port': TYPESENSE_PORT,
            'protocol': TYPESENSE_PROTOCOL
        }],
        'connection_timeout_seconds': 2
    })

    return client.collections['projects'].documents.search(search_parameters)