# Environment Variables Troubleshooting Guide

If the Python script is not picking up environment variables from your `.env` file, follow these steps to debug and fix the issue.

## Problem

The Python script `populate_queue_projects.py` is trying to connect to `localhost` instead of using the database configuration from your `.env` file, OR npm scripts like `npm run migrate` are failing with environment variable errors.

## Root Cause

When you run `source .env` in a shell script, the environment variables are only available in that shell session. To make them available to child processes (like the Python script or psql), they need to be **exported**.

Additionally, npm scripts don't automatically load `.env` files - they need explicit handling.

## Solution

The scripts have been updated to use:
```bash
set -a  # automatically export all variables
source .env
set +a  # stop automatically exporting
```

Instead of just:
```bash
source .env
```

## Debugging Steps

### 1. Check if .env file exists and has correct content

```bash
cd backend

# Check if .env exists
ls -la .env

# If not, copy from example and edit
cp .env.example .env
# Edit .env with your database credentials

# Check content
cat .env
```

Make sure it contains:
```env
POWERNOVA_HOST=your_host
POWERNOVA_PORT=5432
POWERNOVA_DB=your_database
POWERNOVA_USER=your_user
POWERNOVA_PASSWORD=your_password
```

### 2. Debug environment variable loading

```bash
npm run debug-queue-env
```

This will show:
- Contents of your .env file
- Environment variables as seen by the shell script
- Environment variables as seen by the Python script
- Test database connection

### 3. Test Python script directly

```bash
# Activate virtual environment
source venv/bin/activate

# Export environment variables manually
export POWERNOVA_HOST=your_host
export POWERNOVA_PORT=5432
export POWERNOVA_DB=your_database
export POWERNOVA_USER=your_user
export POWERNOVA_PASSWORD=your_password

# Test the Python script
python3 scripts/populate_queue_projects.py debug
python3 scripts/populate_queue_projects.py test
```

### 4. Verify the shell scripts are using the fixed version

Check that your scripts contain:
```bash
# Load environment variables if .env exists
if [ -f "$BACKEND_DIR/.env" ]; then
    # Export all variables from .env
    set -a  # automatically export all variables
    source "$BACKEND_DIR/.env"
    set +a  # stop automatically exporting
fi
```

And NOT just:
```bash
source "$BACKEND_DIR/.env"
```

## Common Issues

### Issue 1: .env file not found
**Symptoms:** Script says "No .env file found"
**Solution:** Create `.env` file in the backend directory with your database configuration

### Issue 2: Environment variables not exported
**Symptoms:** Python script still uses localhost even though .env has different values
**Solution:** Make sure scripts use `set -a; source .env; set +a`

### Issue 3: Virtual environment not activated
**Symptoms:** Import errors for gridstatus or psycopg2
**Solution:** Run `npm run setup-queue-projects` first

### Issue 5: npm run migrate fails with environment variable errors
**Symptoms:** `psql: error: could not translate host name "-U" to address` or similar
**Solution:** 
- Ensure .env file exists: `cp .env.example .env` and edit with your credentials
- Use the new migration script: `npm run migrate`
- The script now properly loads environment variables before running psql

### Issue 6: Database does not exist
**Symptoms:** `database "powernova" does not exist`
**Solution:** The migration script will automatically create the database if it doesn't exist

## Manual Testing

If automated scripts don't work, test manually:

```bash
cd backend

# 1. Activate virtual environment
source venv/bin/activate

# 2. Load environment variables
set -a
source .env
set +a

# 3. Test Python script
python3 scripts/populate_queue_projects.py debug
python3 scripts/populate_queue_projects.py test
```

## Verification

After fixing, verify everything works:

```bash
npm run test-integration
```

This should show:
- ✓ Backend server running
- ✓ API health check passed
- ✓ Python database connection working
- 📊 QueueInfo table row count

## Need Help?

Run the debug script and share the output:
```bash
npm run debug-queue-env
```
