#!/bin/bash

# Quick verification script to check database content without needing backend server

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🔍 Database Content Verification"
echo "================================"

# Load environment variables
if [ -f "$BACKEND_DIR/.env" ]; then
    set -a
    source "$BACKEND_DIR/.env"
    set +a
fi

# Activate virtual environment if available
VENV_DIR="$BACKEND_DIR/venv"
if [ -d "$VENV_DIR" ]; then
    source "$VENV_DIR/bin/activate"
fi

echo "📊 Checking database content..."

python3 -c "
import psycopg2
import os

conn = psycopg2.connect(
    host=os.environ.get('POWERNOVA_HOST', 'localhost'),
    port=int(os.environ.get('POWERNOVA_PORT', 5432)),
    database=os.environ.get('POWERNOVA_DB', 'powernova'),
    user=os.environ.get('POWERNOVA_USER', 'postgres'),
    password=os.environ.get('POWERNOVA_PASSWORD', 'password')
)
cursor = conn.cursor()

print('=== ISO Distribution ===')
cursor.execute('SELECT IsoID, COUNT(*) as count FROM QueueInfo GROUP BY IsoID ORDER BY count DESC')
for row in cursor.fetchall():
    print(f'{row[0]}: {row[1]:,} projects')

print()
print('=== Sample ERCOT Projects ===')
cursor.execute('''
    SELECT IsoID, QueueID, ProjectName, GenerationType, CapacityMW, Status 
    FROM QueueInfo 
    WHERE UPPER(IsoID) = 'ERCOT' 
    ORDER BY QueueDate DESC 
    LIMIT 5
''')
for row in cursor.fetchall():
    print(f'- {row[1]}: {row[2]} ({row[3]}, {row[4]} MW) - {row[5]}')

print()
print('=== Status Distribution for ERCOT ===')
cursor.execute('''
    SELECT Status, COUNT(*) as count 
    FROM QueueInfo 
    WHERE UPPER(IsoID) = 'ERCOT' 
    GROUP BY Status 
    ORDER BY count DESC
''')
for row in cursor.fetchall():
    print(f'{row[0] or \"NULL\"}: {row[1]:,} projects')

print()
print('=== Case-insensitive Testing ===')
test_cases = ['ERCOT', 'ercot', 'Ercot']
for test_iso in test_cases:
    cursor.execute('SELECT COUNT(*) FROM QueueInfo WHERE UPPER(IsoID) = UPPER(%s)', (test_iso,))
    count = cursor.fetchone()[0]
    print(f'{test_iso}: {count:,} projects found')

conn.close()
print()
print('✅ Database verification complete!')
"

echo ""
echo "🎯 Next Steps:"
echo "1. Start the backend server: npm run dev"
echo "2. Test API filtering: npm run test-api-filtering" 
echo "3. Check frontend with ERCOT filter"
