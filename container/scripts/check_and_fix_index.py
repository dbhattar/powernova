#!/usr/bin/env python3
"""
Check the current index creation and optionally cancel/restart with optimized settings.
"""

import os
import sys
from sqlalchemy import create_engine, text

def get_database_url():
    """Get database URL from environment variables"""
    return os.getenv('DATABASE_URL') or os.getenv('AZURE_POSTGRESQL_CONNECTIONSTRING')

def check_and_fix():
    """Check current status and provide recommendations"""
    
    db_url = get_database_url()
    if not db_url:
        print("❌ ERROR: DATABASE_URL not set")
        sys.exit(1)
    
    engine = create_engine(db_url)
    
    with engine.connect() as conn:
        # Check if index exists
        result = conn.execute(text("""
            SELECT indexname, indexdef 
            FROM pg_indexes 
            WHERE indexname = 'document_chunks_embedding_idx'
        """))
        index_row = result.fetchone()
        
        if index_row:
            print("✅ INDEX ALREADY EXISTS!")
            print(f"   Definition: {index_row[1]}")
            print("\n⚠️  The migration should have detected this and skipped.")
            print("    If it's still running, there might be a deadlock or stuck query.")
            return
        
        # Check what's currently running
        result = conn.execute(text("""
            SELECT 
                pid,
                now() - query_start AS duration,
                state,
                wait_event_type,
                wait_event,
                query
            FROM pg_stat_activity
            WHERE query LIKE '%document_chunks_embedding_idx%'
              AND state != 'idle'
              AND pid != pg_backend_pid()
        """))
        
        running_queries = result.fetchall()
        
        if running_queries:
            print(f"\n🔍 Found {len(running_queries)} active index creation query(ies):\n")
            
            for i, row in enumerate(running_queries, 1):
                pid, duration, state, wait_type, wait_event, query = row
                print(f"Query #{i}:")
                print(f"  PID: {pid}")
                print(f"  Duration: {duration}")
                print(f"  State: {state}")
                print(f"  Waiting on: {wait_type} - {wait_event}")
                print(f"  Query: {query[:200]}...")
                print()
            
            # Check for duplicate queries or problematic patterns
            if len(running_queries) > 1:
                print("⚠️  MULTIPLE QUERIES DETECTED!")
                print("   This is unusual and may cause conflicts or slowdowns.")
                print()
            
            # Check if queries are missing CONCURRENTLY
            non_concurrent_found = False
            for row in running_queries:
                query = row[5]
                if 'CONCURRENTLY' not in query and 'CREATE INDEX' in query:
                    non_concurrent_found = True
                    break
            
            if non_concurrent_found:
                print("⚠️  PROBLEM DETECTED!")
                print("   The queries are using regular CREATE INDEX (not CONCURRENTLY)")
                print("   This is slower and blocks other operations.")
                print()
                print("   Options:")
                print("   1. Cancel these queries and restart with CONCURRENTLY")
                print("   2. Wait for completion (may take longer)")
                print()
                
                response = input("   Cancel all queries and restart with CONCURRENTLY? (yes/no): ")
                if response.lower() in ['yes', 'y']:
                    # Cancel all running index creation queries
                    for row in running_queries:
                        pid = row[0]
                        conn.execute(text(f"SELECT pg_cancel_backend({pid})"))
                        print(f"   ✓ Cancelled PID {pid}")
                    
                    # Wait a moment for cancellation
                    import time
                    time.sleep(3)
                    
                    # Create index properly with CONCURRENTLY
                    print("\n   Creating index with CONCURRENTLY (non-blocking)...")
                    try:
                        with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn2:
                            start_time = time.time()
                            
                            conn2.execute(text("""
                                CREATE INDEX CONCURRENTLY document_chunks_embedding_idx
                                ON document_chunks USING hnsw (embedding vector_cosine_ops)
                                WITH (m = 16, ef_construction = 64)
                            """))
                            
                            duration = time.time() - start_time
                            print(f"   ✓ Index created successfully in {duration:.1f} seconds!")
                            print("   ✓ This method doesn't block reads/writes")
                    except Exception as e:
                        if 'already exists' in str(e).lower():
                            print("   ✓ Index already exists (created while we were cancelling)")
                        else:
                            print(f"   ✗ Error: {e}")
                            print("\n   You can try manually:")
                            print("   1. Connect to database")
                            print("   2. Run: CREATE INDEX CONCURRENTLY document_chunks_embedding_idx")
                            print("           ON document_chunks USING hnsw (embedding vector_cosine_ops)")
                            print("           WITH (m = 16, ef_construction = 64);")
                    return
            
            # Check for IF NOT EXISTS with CONCURRENTLY
            for row in running_queries:
                query = row[5]
                if 'IF NOT EXISTS' in query and 'CONCURRENTLY' in query:
                    print("⚠️  PROBLEM DETECTED!")
                    print("   The query uses 'CREATE INDEX CONCURRENTLY IF NOT EXISTS'")
                    print("   This is NOT supported by PostgreSQL!")
                    print()
                    print("   Options:")
                    print(f"   1. Cancel this query (PID: {row[0]}):")
                    print(f"      SELECT pg_cancel_backend({row[0]});")
                    print()
                    print("   2. Then create index properly:")
                    print("      CREATE INDEX CONCURRENTLY document_chunks_embedding_idx")
                    print("      ON document_chunks USING hnsw (embedding vector_cosine_ops)")
                    print("      WITH (m = 16, ef_construction = 64);")
                    print()
                    
                    # Ask if user wants to cancel
                    response = input("   Cancel this query and restart? (yes/no): ")
                    if response.lower() in ['yes', 'y']:
                        conn.execute(text(f"SELECT pg_cancel_backend({row[0]})"))
                        print(f"   ✓ Cancelled PID {row[0]}")
                        
                        # Wait a moment
                        import time
                        time.sleep(2)
                        
                        # Create index properly
                        print("\n   Creating index with correct syntax...")
                        with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn2:
                            conn2.execute(text("""
                                CREATE INDEX CONCURRENTLY document_chunks_embedding_idx
                                ON document_chunks USING hnsw (embedding vector_cosine_ops)
                                WITH (m = 16, ef_construction = 64)
                            """))
                        print("   ✓ Index creation started successfully!")
                    return
            
            # If duration is very long, suggest cancelling
            max_duration = max(row[1] for row in running_queries)
            if max_duration.total_seconds() > 1800:  # 30 minutes
                print("⚠️  Index creation has been running for > 30 minutes!")
                print("   This is unusually long for 160k chunks.")
                print()
                print("   Possible issues:")
                print("   - Database resources are limited")
                print("   - Query might be stuck")
                print("   - Using non-CONCURRENTLY method (slower)")
                print()
                print("   Recommendation: Cancel and retry with optimized parameters")
        else:
            print("✓ No active index creation queries found")
            print("  The index might have completed or not started yet")
            
            # Check migration status
            result = conn.execute(text("""
                SELECT version_num 
                FROM alembic_version 
                WHERE version_num = 'chunks_vector_idx_001'
            """))
            
            if result.fetchone():
                print("\n⚠️  Migration is marked as complete, but index doesn't exist!")
                print("   This suggests the migration failed silently.")
                print("\n   Run: python scripts/create_vector_index.py --create")
    
    engine.dispose()

if __name__ == '__main__':
    check_and_fix()
