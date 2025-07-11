# PowerNOVA Queue Projects Integration

This document explains how to integrate ISO/RTO interconnection queue data into the PowerNOVA backend using the `gridstatus` Python library.

## Overview

The integration uses Python scripts to fetch real-time ISO/RTO interconnection queue data and populate the PostgreSQL database, which is then served by the existing Node.js backend API.

## Architecture

```
gridstatus (Python) → PostgreSQL → Node.js Backend → React Native Frontend
```

1. **Python Scripts**: Use `gridstatus` library to fetch ISO/RTO data
2. **PostgreSQL**: Store queue data in `QueueInfo` table
3. **Node.js Backend**: Serve data via existing `/api/projects` endpoints
4. **Frontend**: Display data using existing UI components

## Setup Instructions

### 1. Prerequisites

- PostgreSQL running and accessible
- Python 3.8+ installed
- Node.js backend environment configured

### 2. Database Setup

First, ensure the database tables are created:

```bash
cd backend
npm run migrate
```

This creates the `QueueInfo` table with the schema:
- `IsoID`: ISO identifier (CAISO, PJM, ERCOT, etc.)
- `QueueID`: Unique project queue identifier
- `ProjectName`: Name of the interconnection project
- `InterconnectingEntity`: Company/entity requesting interconnection
- `County`, `StateName`: Project location
- `GenerationType`: Solar, Wind, Battery Storage, etc.
- `CapacityMW`: Project capacity in megawatts
- `QueueDate`: Date project entered queue
- `Status`: ACTIVE, WITHDRAWN, etc.
- Additional project details and timestamps

### 3. Python Environment Setup

Set up the Python environment and dependencies:

```bash
cd backend
npm run setup-queue-projects
```

This script will:
- Create a Python virtual environment
- Install required dependencies (`gridstatus`, `psycopg2-binary`, `pandas`)
- Test database connection
- Show available ISOs

### 4. Environment Variables

The Python scripts use the same environment variables as the Node.js backend:

```bash
export POWERNOVA_HOST=localhost
export POWERNOVA_PORT=5432
export POWERNOVA_DB=powernova
export POWERNOVA_USER=postgres
export POWERNOVA_PASSWORD=your_password
```

### 5. Populate Queue Data

#### Test Connection
```bash
npm run test-queue-connection
```

#### List Available ISOs
```bash
npm run list-isos
```

#### Populate Specific ISO
```bash
npm run populate-queue-data populate CAISO
```

#### Populate All ISOs
```bash
npm run populate-all-isos
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run setup-queue-projects` | Initial setup of Python environment |
| `npm run test-queue-connection` | Test database connection |
| `npm run list-isos` | List available ISOs |
| `npm run populate-queue-data <iso>` | Populate specific ISO data |
| `npm run populate-all-isos` | Populate all available ISOs |

## Supported ISOs

The `gridstatus` library supports:
- **CAISO** - California ISO
- **PJM** - PJM Interconnection
- **ERCOT** - Electric Reliability Council of Texas
- **MISO** - Midcontinent ISO
- **ISONE** - ISO New England
- **NYISO** - New York ISO
- **SPP** - Southwest Power Pool

## API Endpoints

After population, the data is available through existing Node.js endpoints:

### Get All Projects
```
GET /api/projects/projects?limit=50&offset=0
```

### Get Projects by ISO
```
GET /api/projects/projects/CAISO?limit=50&offset=0
```

### Get Project Details
```
GET /api/projects/project-details?isoId=CAISO&queueId=PROJECT123
```

### Search Projects
```
GET /api/projects/search?query=solar&page=1&per_page=20
```

## Example Response

```json
{
  "count": 1500,
  "results": [
    {
      "IsoID": "CAISO",
      "QueueID": "Q0123",
      "ProjectName": "Desert Solar Project",
      "InterconnectingEntity": "Desert Energy LLC",
      "County": "Riverside",
      "StateName": "California",
      "GenerationType": "Solar",
      "CapacityMW": 150.0,
      "QueueDate": "2023-01-15",
      "Status": "ACTIVE",
      "ProposedCompletionDate": "2025-12-31"
    }
  ]
}
```

## Data Update Strategy

### Manual Updates
```bash
npm run populate-queue-data populate CAISO
```

### Automated Updates (Recommended)
Create a cron job to update data periodically:

```bash
# Update all ISOs daily at 2 AM
0 2 * * * cd /path/to/powernova/backend && npm run populate-all-isos
```

### Update Specific ISOs
For frequently changing ISOs, update more often:

```bash
# Update CAISO every 6 hours
0 */6 * * * cd /path/to/powernova/backend && npm run populate-queue-data populate CAISO
```

## Troubleshooting

### Database Connection Issues
```bash
npm run test-queue-connection
```

Check:
- PostgreSQL is running
- Environment variables are set correctly
- Database `powernova` exists
- User has proper permissions

### Python Dependencies Issues
```bash
# Recreate virtual environment
rm -rf backend/venv
npm run setup-queue-projects
```

### Data Population Failures
Some ISOs may not support interconnection queue APIs. Check the logs for specific error messages.

### Memory Issues
For large datasets, consider populating ISOs one at a time:
```bash
npm run populate-queue-data populate CAISO
npm run populate-queue-data populate PJM
# ... etc
```

## Monitoring

### Check Data Counts
```sql
SELECT IsoID, COUNT(*) as project_count 
FROM QueueInfo 
GROUP BY IsoID 
ORDER BY project_count DESC;
```

### Check Recent Updates
```sql
SELECT IsoID, MAX(updated_at) as last_update 
FROM QueueInfo 
GROUP BY IsoID;
```

### Verify API Response
```bash
curl 'http://localhost:3001/api/projects/projects' | jq '.count'
```

## Performance Considerations

1. **Indexing**: The setup creates appropriate indexes on `IsoID`, `Status`, `GenerationType`, etc.
2. **Pagination**: API endpoints support pagination with `limit` and `offset`
3. **Caching**: Consider implementing Redis caching for frequently accessed data
4. **Updates**: Use UPSERT logic to handle updates efficiently

## Security Notes

1. Environment variables should be properly secured
2. Database credentials should not be committed to version control
3. Consider using connection pooling for high-traffic scenarios
4. Regular security updates for Python dependencies

## Next Steps

1. Set up automated data refresh schedules
2. Implement data quality monitoring
3. Add more sophisticated search and filtering
4. Consider adding real-time data feeds where available
5. Implement data archival for withdrawn projects
