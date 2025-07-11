#!/usr/bin/env python3

"""
PowerNOVA Queue Projects Population Script

This script populates the PostgreSQL QueueInfo table with ISO/RTO interconnection queue data
using the gridstatus library. It uses the same database connection parameters as the Node.js backend.

Requirements:
- gridstatus library for ISO/RTO data fetching
- psycopg2-binary for PostgreSQL connectivity
- pandas and numpy for data processing

Environment Variables (same as Node.js backend):
- POWERNOVA_HOST: PostgreSQL host (default: localhost)
- POWERNOVA_PORT: PostgreSQL port (default: 5432)
- POWERNOVA_DB: Database name (default: powernova)
- POWERNOVA_USER: Database user (default: postgres)
- POWERNOVA_PASSWORD: Database password (default: password)
"""

import psycopg2
from psycopg2 import errors
import gridstatus
import json
import pandas as pd
import numpy as np
import os
import sys
import logging
import time
from datetime import datetime, timedelta
import time
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Database connection parameters (same as Node.js backend)
DB_CONFIG = {
    'database': os.environ.get('POWERNOVA_DB', 'powernova'),
    'host': os.environ.get('POWERNOVA_HOST', 'localhost'),
    'user': os.environ.get('POWERNOVA_USER', 'postgres'),
    'password': os.environ.get('POWERNOVA_PASSWORD', 'password'),
    'port': int(os.environ.get('POWERNOVA_PORT', 5432))
}

def get_db_connection():
    """Create a new database connection"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        logger.info(f"Connected to database: {DB_CONFIG['database']}@{DB_CONFIG['host']}:{DB_CONFIG['port']}")
        return conn
    except Exception as e:
        logger.error(f"Failed to connect to database: {e}")
        raise

def test_db_connection():
    """Test database connection and QueueInfo table existence"""
    try:
        # Show what environment variables we're actually using
        logger.info("Database configuration:")
        logger.info(f"  Host: {DB_CONFIG['host']}")
        logger.info(f"  Port: {DB_CONFIG['port']}")
        logger.info(f"  Database: {DB_CONFIG['database']}")
        logger.info(f"  User: {DB_CONFIG['user']}")
        logger.info(f"  Password: {'***' if DB_CONFIG['password'] else 'NOT SET'}")
        
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1 FROM QueueInfo LIMIT 1")
            logger.info("✓ Database connection successful and QueueInfo table exists")
        conn.close()
        return True
    except psycopg2.Error as e:
        if "does not exist" in str(e):
            logger.error("❌ QueueInfo table does not exist. Please run database migration first:")
            logger.error("  cd backend && npm run migrate")
        else:
            logger.error(f"❌ Database connection failed: {e}")
        return False
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}")
        return False

def populate_queue_projects(conn, iso_id, iso_instance):
    """Populate queue projects for a specific ISO"""
    try:
        logger.info(f"Fetching interconnection queue data for {iso_id}...")
        logger.info(f"📡 Connecting to {iso_id} grid status API...")
        start_time = time.time()
        
        df = iso_instance.get_interconnection_queue()
        
        if df.empty:
            logger.warning(f"⚠️  No data available for {iso_id}")
            return 0
        
        fetch_time = time.time() - start_time
        total_rows = len(df)
        logger.info(f"✅ Fetched {total_rows:,} records for {iso_id} in {fetch_time:.1f}s")
        
        # Clean the dataframe
        logger.info(f"🧹 Cleaning data for {iso_id}...")
        gdf = df.replace({pd.NaT: None, np.nan: None, "TBD": None, " ": None})
        
        insert_query = """INSERT INTO QueueInfo
            (IsoID, QueueID, ProjectName, InterconnectingEntity, County, StateName,
            InterconnectionLocation, TransmissionOwner, GenerationType, CapacityMW,
            SummerCapacity, WinterCapacityMW, QueueDate, Status, ProposedCompletionDate, 
            WithdrawnDate, WithdrawalComment, ActualCompletionDate, AdditionalInfo) VALUES
            (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (IsoID, QueueID) DO UPDATE SET
            ProjectName = EXCLUDED.ProjectName,
            InterconnectingEntity = EXCLUDED.InterconnectingEntity,
            County = EXCLUDED.County,
            StateName = EXCLUDED.StateName,
            InterconnectionLocation = EXCLUDED.InterconnectionLocation,
            TransmissionOwner = EXCLUDED.TransmissionOwner,
            GenerationType = EXCLUDED.GenerationType,
            CapacityMW = EXCLUDED.CapacityMW,
            SummerCapacity = EXCLUDED.SummerCapacity,
            WinterCapacityMW = EXCLUDED.WinterCapacityMW,
            QueueDate = EXCLUDED.QueueDate,
            Status = EXCLUDED.Status,
            ProposedCompletionDate = EXCLUDED.ProposedCompletionDate,
            WithdrawnDate = EXCLUDED.WithdrawnDate,
            WithdrawalComment = EXCLUDED.WithdrawalComment,
            ActualCompletionDate = EXCLUDED.ActualCompletionDate,
            AdditionalInfo = EXCLUDED.AdditionalInfo,
            updated_at = NOW()"""
        
        inserted_count = 0
        updated_count = 0
        error_count = 0
        batch_size = 100  # Process in batches for better progress reporting
        
        logger.info(f"💾 Processing {total_rows:,} records for {iso_id}...")
        process_start_time = time.time()
        
        with conn.cursor() as cursor:
            for index, row in gdf.iterrows():
                try:
                    # Show progress every batch_size records
                    if index % batch_size == 0 and index > 0:
                        elapsed = time.time() - process_start_time
                        rate = index / elapsed if elapsed > 0 else 0
                        eta = (total_rows - index) / rate if rate > 0 else 0
                        progress_pct = (index / total_rows) * 100
                        
                        # Create progress bar
                        bar_length = 30
                        filled_length = int(bar_length * progress_pct / 100)
                        bar = '█' * filled_length + '░' * (bar_length - filled_length)
                        
                        logger.info(f"📊 {iso_id}: [{bar}] {progress_pct:.1f}% "
                                   f"({index:,}/{total_rows:,}) - "
                                   f"{rate:.0f} rec/s - ETA: {eta/60:.1f}m - "
                                   f"✅{inserted_count} ❌{error_count}")
                        
                        # Commit batch for progress consistency
                        conn.commit()
                    
                    # Debug: Show column structure for first few rows only
                    if index < 3:
                        logger.info(f"Row {index} columns for {iso_id}: {list(row.index)}")
                    
                    # Map common column names to our database fields
                    # Different ISOs use different column names, so we need to be flexible
                    def safe_get(column_names, default=None):
                        """Safely get value from row by trying different possible column names"""
                        for col_name in column_names if isinstance(column_names, list) else [column_names]:
                            if col_name in row.index:
                                val = row[col_name]
                                # Convert NaN, NaT, "TBD", empty strings to None
                                if pd.isna(val) or val in ["TBD", "", " "]:
                                    return None
                                return val
                        return default
                    
                    # Extract data using flexible column mapping
                    queue_id = safe_get(['Queue ID', 'QueueID', 'Project ID', 'ProjectID', 'ID'])
                    project_name = safe_get(['Project Name', 'ProjectName', 'Name', 'Facility Name'])
                    interconnecting_entity = safe_get(['Interconnecting Entity', 'InterconnectingEntity', 'Company', 'Developer', 'Sponsor'])
                    county = safe_get(['County', 'County Name'])
                    state_name = safe_get(['State', 'StateName', 'State Name'])
                    interconnection_location = safe_get(['Interconnection Location', 'InterconnectionLocation', 'Point of Interconnection', 'POI'])
                    transmission_owner = safe_get(['Transmission Owner', 'TransmissionOwner', 'TO', 'Utility'])
                    generation_type = safe_get(['Generation Type', 'GenerationType', 'Technology', 'Fuel Type', 'Type'])
                    capacity_mw = safe_get(['Capacity (MW)', 'CapacityMW', 'Capacity', 'MW', 'Size (MW)'])
                    summer_capacity = safe_get(['Summer Capacity', 'SummerCapacity', 'Summer MW'])
                    winter_capacity = safe_get(['Winter Capacity', 'WinterCapacity', 'Winter MW'])
                    queue_date = safe_get(['Queue Date', 'QueueDate', 'Application Date', 'Date Entered'])
                    status = safe_get(['Status', 'Project Status'])
                    proposed_completion = safe_get(['Proposed Completion Date', 'ProposedCompletionDate', 'COD', 'In Service Date'])
                    withdrawn_date = safe_get(['Withdrawn Date', 'WithdrawnDate', 'Withdrawal Date'])
                    withdrawal_comment = safe_get(['Withdrawal Comment', 'WithdrawalComment', 'Withdrawal Reason'])
                    actual_completion = safe_get(['Actual Completion Date', 'ActualCompletionDate', 'Actual COD'])
                    
                    # Create additional info from remaining columns
                    additional_info = {}
                    for col in row.index:
                        if col not in ['Queue ID', 'QueueID', 'Project ID', 'ProjectID', 'Project Name', 'ProjectName'] and pd.notna(row[col]):
                            additional_info[col] = str(row[col])
                    
                    additional_info_json = json.dumps(additional_info) if additional_info else None
                    
                    # Prepare data tuple for database insert
                    data = [
                        iso_id.upper(),  # Normalize ISO ID to uppercase
                        queue_id,
                        project_name,
                        interconnecting_entity,
                        county,
                        state_name,
                        interconnection_location,
                        transmission_owner,
                        generation_type,
                        capacity_mw,
                        summer_capacity,
                        winter_capacity,
                        queue_date,
                        status,
                        proposed_completion,
                        withdrawn_date,
                        withdrawal_comment,
                        actual_completion,
                        additional_info_json
                    ]
                    
                    # Skip if we don't have minimum required fields
                    if not queue_id:
                        if error_count < 5:  # Only log first few missing queue ID warnings
                            logger.warning(f"Row {index} for {iso_id}: No queue ID found, skipping")
                        error_count += 1
                        continue
                    
                    cursor.execute(insert_query, data)
                    
                    # Check if it was an insert or update
                    if cursor.rowcount > 0:
                        inserted_count += 1
                    
                    # Commit in batches for better performance and progress tracking
                    if index % batch_size == 0:
                        conn.commit()
                    
                except Exception as e:
                    error_count += 1
                    if error_count <= 3:  # Only log first few errors
                        logger.warning(f"Error processing row {index} for {iso_id}: {e}")
                        if error_count == 1:  # Show more detail for first error
                            logger.warning(f"Row data: {dict(row)}")
                    conn.rollback()
                    continue
            
            # Final commit
            conn.commit()
        
        total_time = time.time() - start_time
        process_time = time.time() - process_start_time
        avg_rate = inserted_count / process_time if process_time > 0 else 0
        
        logger.info(f"\n🎉 {iso_id} Population Complete!")
        logger.info(f"   📊 Successfully processed: {inserted_count:,}/{total_rows:,} records ({(inserted_count/total_rows)*100:.1f}%)")
        logger.info(f"   ⏱️  Total time: {total_time:.1f}s (fetch: {fetch_time:.1f}s, process: {process_time:.1f}s)")
        logger.info(f"   🚀 Processing rate: {avg_rate:.0f} records/second")
        if error_count > 0:
            logger.info(f"   ⚠️  Errors/skipped: {error_count:,} records")
        
        return inserted_count
        
    except Exception as e:
        logger.error(f"Failed to populate data for {iso_id}: {e}")
        conn.rollback()
        return 0

def populate_projects_for_iso(iso_id):
    """Populate projects for a specific ISO"""
    if not test_db_connection():
        return False
    
    conn = get_db_connection()
    
    try:
        isos = gridstatus.list_isos()
        
        for index, iso in isos.iterrows():
            if iso['Class'].upper() == iso_id.upper():
                iso_class = getattr(gridstatus, iso['Class'])
                try:
                    iso_instance = iso_class()
                    logger.info(f"Populating queue projects for {iso['Class']}")
                    count = populate_queue_projects(conn, iso['Class'], iso_instance)
                    logger.info(f"✓ Completed {iso['Class']}: {count} records processed")
                    return True
                except (ValueError, NotImplementedError) as e:
                    logger.error(f"Failed to process {iso['Class']}: {e}")
                    return False
                break
        
        logger.error(f"ISO '{iso_id}' not found in available ISOs")
        return False
        
    finally:
        conn.close()

def populate_projects_for_all_isos():
    """Populate projects for all available ISOs"""
    if not test_db_connection():
        return False
    
    conn = get_db_connection()
    
    try:
        isos = gridstatus.list_isos()
        total_processed = 0
        successful_isos = []
        failed_isos = []
        iso_stats = {}
        
        overall_start_time = time.time()
        
        logger.info(f"\n{'='*70}")
        logger.info(f"🚀 Starting population for {len(isos)} ISOs")
        logger.info(f"{'='*70}")
        logger.info(f"Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        for index, iso in isos.iterrows():
            iso_start_time = time.time()
            iso_class = getattr(gridstatus, iso['Class'])
            
            logger.info(f"\n📍 Processing ISO {index + 1}/{len(isos)}: {iso['Class']} ({iso['Name']})")
            
            try:
                iso_instance = iso_class()
                count = populate_queue_projects(conn, iso['Class'], iso_instance)
                iso_time = time.time() - iso_start_time
                
                total_processed += count
                successful_isos.append(iso['Class'])
                iso_stats[iso['Class']] = {
                    'records': count,
                    'time': iso_time,
                    'status': 'success'
                }
                
                logger.info(f"✅ {iso['Class']} completed: {count:,} records in {iso_time:.1f}s")
                
            except (ValueError, NotImplementedError) as e:
                iso_time = time.time() - iso_start_time
                failed_isos.append((iso['Class'], str(e)))
                iso_stats[iso['Class']] = {
                    'records': 0,
                    'time': iso_time,
                    'status': 'not_implemented',
                    'error': str(e)
                }
                logger.warning(f"⚠️  {iso['Class']} not implemented: {e}")
                
            except Exception as e:
                iso_time = time.time() - iso_start_time
                failed_isos.append((iso['Class'], str(e)))
                iso_stats[iso['Class']] = {
                    'records': 0,
                    'time': iso_time,
                    'status': 'error',
                    'error': str(e)
                }
                logger.error(f"❌ {iso['Class']} failed: {e}")
        
        overall_time = time.time() - overall_start_time
        
        # Final summary with detailed statistics
        logger.info(f"\n{'='*70}")
        logger.info(f"📊 FINAL POPULATION SUMMARY")
        logger.info(f"{'='*70}")
        logger.info(f"⏱️  Total time: {str(timedelta(seconds=int(overall_time)))}")
        logger.info(f"📈 Total records processed: {total_processed:,}")
        logger.info(f"✅ Successful ISOs: {len(successful_isos)}/{len(isos)}")
        logger.info(f"❌ Failed ISOs: {len(failed_isos)}/{len(isos)}")
        
        if successful_isos:
            avg_rate = total_processed / overall_time if overall_time > 0 else 0
            logger.info(f"🚀 Overall processing rate: {avg_rate:.0f} records/second")
            
            logger.info(f"\n✅ Successful ISOs:")
            for iso_name in successful_isos:
                stats = iso_stats[iso_name]
                rate = stats['records'] / stats['time'] if stats['time'] > 0 else 0
                logger.info(f"   • {iso_name}: {stats['records']:,} records ({rate:.0f} rec/s)")
        
        if failed_isos:
            logger.info(f"\n❌ Failed ISOs:")
            for iso_name, error in failed_isos:
                stats = iso_stats[iso_name]
                status_emoji = "⚠️ " if stats['status'] == 'not_implemented' else "❌"
                logger.info(f"   {status_emoji} {iso_name}: {error}")
        
        logger.info(f"\n🏁 Population process completed at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        return len(successful_isos) > 0
        
    finally:
        conn.close()

def inspect_iso_data(iso_id):
    """Inspect the data structure for a specific ISO to help debug issues"""
    try:
        isos = gridstatus.list_isos()
        
        for index, iso in isos.iterrows():
            if iso['Class'].upper() == iso_id.upper():
                iso_class = getattr(gridstatus, iso['Class'])
                try:
                    iso_instance = iso_class()
                    logger.info(f"Inspecting data structure for {iso['Class']}")
                    
                    df = iso_instance.get_interconnection_queue()
                    
                    if df.empty:
                        logger.warning(f"No data available for {iso_id}")
                        return True
                    
                    logger.info(f"Data shape: {df.shape} (rows, columns)")
                    logger.info(f"Column names: {list(df.columns)}")
                    logger.info(f"Data types:\n{df.dtypes}")
                    
                    if len(df) > 0:
                        logger.info(f"Sample data (first row):\n{df.iloc[0].to_dict()}")
                    
                    return True
                    
                except (ValueError, NotImplementedError) as e:
                    logger.error(f"Failed to inspect {iso['Class']}: {e}")
                    return False
                break
        
        logger.error(f"ISO '{iso_id}' not found in available ISOs")
        return False
        
    except Exception as e:
        logger.error(f"Failed to inspect ISO data: {e}")
        return False

def debug_environment():
    """Debug environment variables"""
    logger.info("=== Environment Debug Information ===")
    logger.info("All PowerNOVA environment variables:")
    for key in sorted(os.environ.keys()):
        if key.startswith('POWERNOVA_'):
            value = os.environ[key]
            if 'PASSWORD' in key:
                value = '***' if value else 'NOT SET'
            logger.info(f"  {key} = {value}")
    
    logger.info("\nDatabase configuration being used:")
    for key, value in DB_CONFIG.items():
        if key == 'password':
            value = '***' if value else 'NOT SET'
        logger.info(f"  {key} = {value}")
    return True

def list_available_isos():
    """List all available ISOs that can be processed"""
    try:
        isos = gridstatus.list_isos()
        logger.info("Available ISOs:")
        for index, iso in isos.iterrows():
            logger.info(f"  - {iso['Class']}: {iso['Name']}")
        return True
    except Exception as e:
        logger.error(f"Failed to list ISOs: {e}")
        return False

def main():
    """Main CLI interface"""
    if len(sys.argv) < 2:
        print(f"""
PowerNOVA Queue Projects Population Tool

Usage:
  {sys.argv[0]} test               # Test database connection
  {sys.argv[0]} debug              # Show environment variables and config
  {sys.argv[0]} inspect <ISO>      # Inspect data structure for specific ISO
  {sys.argv[0]} list               # List available ISOs
  {sys.argv[0]} populate [ISO]     # Populate specific ISO (e.g., CAISO) or all if no ISO specified
  {sys.argv[0]} populate-all       # Populate all available ISOs

Examples:
  {sys.argv[0]} test
  {sys.argv[0]} debug
  {sys.argv[0]} inspect ERCOT
  {sys.argv[0]} populate CAISO
  {sys.argv[0]} populate-all

Environment Variables (same as Node.js backend):
  POWERNOVA_HOST={DB_CONFIG['host']}
  POWERNOVA_PORT={DB_CONFIG['port']}
  POWERNOVA_DB={DB_CONFIG['database']}
  POWERNOVA_USER={DB_CONFIG['user']}
  POWERNOVA_PASSWORD=*** (not shown)
        """)
        return False
    
    command = sys.argv[1].lower()
    
    if command == 'test':
        return test_db_connection()
    
    elif command == 'debug':
        return debug_environment()
    
    elif command == 'inspect':
        if len(sys.argv) > 2:
            iso_id = sys.argv[2].upper()
            return inspect_iso_data(iso_id)
        else:
            logger.error("Please specify an ISO to inspect. Example: python3 script.py inspect ERCOT")
            return False
    
    elif command == 'list':
        return list_available_isos()
    
    elif command == 'populate':
        if len(sys.argv) > 2:
            iso_id = sys.argv[2].upper()
            return populate_projects_for_iso(iso_id)
        else:
            return populate_projects_for_all_isos()
    
    elif command == 'populate-all':
        return populate_projects_for_all_isos()
    
    else:
        logger.error(f"Unknown command: {command}")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
