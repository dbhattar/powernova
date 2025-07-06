# PowerNOVA Projects API Integration

This document describes the integration of ISO/RTO project data and search functionality into the PowerNOVA Express.js backend.

## Overview

The PowerNOVA Projects API provides endpoints for:
- Querying interconnection queue projects by ISO/RTO
- Searching projects using full-text search
- Retrieving GIS data for mapping
- Getting project-specific details

## API Endpoints

### Projects

#### Get Projects
```
GET /api/projects/projects/:iso?
```

**Parameters:**
- `iso` (optional): ISO/RTO identifier (CAISO, PJM, ERCOT, etc.)
- `offset` (query): Starting offset for pagination (default: 0)
- `limit` (query): Number of results to return (default: 10, max: 100)

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3001/api/projects/projects/CAISO?offset=0&limit=20"
```

#### Get Project Details
```
GET /api/projects/project-details
```

**Parameters:**
- `isoId` (required): ISO/RTO identifier
- `queueId` (required): Queue ID for the specific project

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3001/api/projects/project-details?isoId=CAISO&queueId=A123"
```

#### Search Projects
```
GET /api/projects/search
```

**Parameters:**
- `query` (required): Search query string
- `page` (optional): Page number (default: 1)
- `per_page` (optional): Results per page (default: 10, max: 50)

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3001/api/projects/search?query=solar&page=1&per_page=20"
```

### Geographic Data

#### Get County Map
```
GET /api/projects/gis/county-map
```

Returns GeoJSON data for US counties.

#### Get RTO/ISO Map
```
GET /api/projects/gis/rto-iso-map/:rtoIso?
```

**Parameters:**
- `rtoIso` (optional): Specific RTO/ISO to filter by

Returns GeoJSON data for RTO/ISO regions.

#### Get State Information
```
GET /api/projects/state/:stateId
```

**Parameters:**
- `stateId` (required): State code
- `county_id` (optional): County code

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Environment Configuration

Update your `.env` file with the following variables:

```env
# PowerNOVA Database Configuration
POWERNOVA_DB=powernova
POWERNOVA_USER=postgres
POWERNOVA_PASSWORD=your_database_password
POWERNOVA_HOST=localhost
POWERNOVA_PORT=5432

# Typesense Configuration
TYPESENSE_HOST=localhost
TYPESENSE_PORT=8108
TYPESENSE_PROTOCOL=http
TYPESENSE_API_KEY=your_typesense_api_key

# GIS Data Directory
DATA_DIR=/path/to/your/gis/data
```

### 3. Database Setup

```bash
# Create database schema
npm run setup-db

# Populate with ISO/RTO data (requires Python environment)
npm run populate-db
```

### 4. Python Dependencies

The data population script requires Python with these packages:
```bash
pip install psycopg2-binary gridstatus pandas numpy
```

### 5. GIS Data

Place your GIS data files in the following structure:
```
data/
├── gis/
│   ├── state_codes.json
│   ├── cb_2018_us_county_500k/
│   │   └── us_county.json
│   └── RTO_Regions.geojson
```

### 6. Typesense Setup

Install and configure Typesense for search functionality:

```bash
# Using Docker
docker run -d -p 8108:8108 \
  -v/tmp/typesense-data:/data \
  -e TYPESENSE_API_KEY=your_api_key \
  typesense/typesense:0.25.1
```

## Data Model

### QueueInfo Table

The main projects table contains:

```sql
CREATE TABLE QueueInfo (
    id SERIAL PRIMARY KEY,
    IsoID VARCHAR(20) NOT NULL,
    QueueID VARCHAR(100) NOT NULL,
    ProjectName VARCHAR(255),
    InterconnectingEntity VARCHAR(255),
    County VARCHAR(100),
    StateName VARCHAR(100),
    InterconnectionLocation VARCHAR(255),
    TransmissionOwner VARCHAR(255),
    GenerationType VARCHAR(100),
    CapacityMW DECIMAL(10,2),
    SummerCapacity DECIMAL(10,2),
    WinterCapacityMW DECIMAL(10,2),
    QueueDate DATE,
    Status VARCHAR(50),
    ProposedCompletionDate DATE,
    WithdrawnDate DATE,
    WithdrawalComment TEXT,
    ActualCompletionDate DATE,
    AdditionalInfo JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(IsoID, QueueID)
);
```

## Authentication

All API endpoints require Firebase authentication. Include the Firebase ID token in the Authorization header:

```bash
Authorization: Bearer YOUR_FIREBASE_ID_TOKEN
```

## Error Handling

The API returns standard HTTP status codes:
- `200`: Success
- `400`: Bad Request (invalid parameters)
- `401`: Unauthorized (missing or invalid token)
- `404`: Not Found
- `500`: Internal Server Error

Error responses include a JSON object with an `error` field:
```json
{
  "error": "Description of the error"
}
```

## Performance Considerations

- Database queries are optimized with indexes
- Large datasets are paginated
- GIS data is cached in memory
- Search is powered by Typesense for fast full-text search

## Testing

Test the API endpoints:

```bash
# Health check
curl "http://localhost:3001/api/projects/health"

# Test with authentication
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3001/api/projects/projects/CAISO?limit=5"
```

## Migration from FastAPI

The Express.js implementation provides equivalent functionality to the FastAPI prototype:

| FastAPI Endpoint | Express.js Endpoint |
|------------------|---------------------|
| `/api/get_projects/{iso}` | `/api/projects/projects/{iso}` |
| `/api/get_project_details` | `/api/projects/project-details` |
| `/api/search` | `/api/projects/search` |
| `/api/get_county_map` | `/api/projects/gis/county-map` |
| `/api/get_rto_iso_map` | `/api/projects/gis/rto-iso-map` |
| `/api/get_state/{state_id}` | `/api/projects/state/{stateId}` |

## Next Steps

1. **Frontend Integration**: Update the React Native app to use the new endpoints
2. **Data Synchronization**: Set up periodic updates from ISO/RTO sources
3. **Advanced Search**: Add more sophisticated search filters
4. **Caching**: Implement Redis caching for frequently accessed data
5. **Monitoring**: Add logging and monitoring for production deployment
