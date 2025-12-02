#!/usr/bin/env python3
"""
Manual script to create HNSW vector index on document_chunks table.

This script can be used to:
1. Check if the index exists
2. Monitor index creation progress
3. Create the index with CONCURRENTLY option (no blocking)

Usage:
    python scripts/create_vector_index.py --check          # Check index status
    python scripts/create_vector_index.py --create         # Create index CONCURRENTLY
    python scripts/create_vector_index.py --progress       # Monitor creation progress
"""

import os
import sys
import time
import argparse
from sqlalchemy import create_engine, text

def get_database_url():
    """Get database URL from environment variables"""
    return os.getenv('DATABASE_URL') or os.getenv('AZURE_POSTGRESQL_CONNECTIONSTRING')

def check_index_exists(engine):
    """Check if the vector index exists"""
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT 
                schemaname,
                tablename,
                indexname,
                indexdef
            FROM pg_indexes 
            WHERE indexname = 'document_chunks_embedding_idx'
        """))
        
        row = result.fetchone()
        if row:
            print("✓ Index EXISTS")
            print(f"  Schema: {row[0]}")
            print(f"  Table: {row[1]}")
            print(f"  Index: {row[2]}")
            print(f"  Definition: {row[3]}")
            return True
        else:
            print("✗ Index DOES NOT EXIST")
            return False

def check_index_progress(engine):
    """Check if index is currently being created and show progress"""
    with engine.connect() as conn:
        # Check for ongoing index creation
        result = conn.execute(text("""
            SELECT 
                a.query,
                now() - a.query_start AS duration,
                a.state,
                a.wait_event_type,
                a.wait_event
            FROM pg_stat_activity a
            WHERE a.query LIKE '%document_chunks_embedding_idx%'
              AND a.state != 'idle'
              AND a.query NOT LIKE '%pg_stat_activity%'
        """))
        
        rows = result.fetchall()
        if rows:
            print("\n📊 Index creation IN PROGRESS:")
            for row in rows:
                print(f"  Duration: {row[1]}")
                print(f"  State: {row[2]}")
                print(f"  Waiting on: {row[3]} - {row[4]}")
                print(f"  Query: {row[0][:100]}...")
            return True
        else:
            print("\n✓ No active index creation process found")
            return False

def get_table_stats(engine):
    """Get statistics about the document_chunks table"""
    with engine.connect() as conn:
        # Total chunks
        result = conn.execute(text("SELECT COUNT(*) FROM document_chunks"))
        total_chunks = result.scalar()
        
        # Chunks with embeddings
        result = conn.execute(text("SELECT COUNT(*) FROM document_chunks WHERE embedding IS NOT NULL"))
        chunks_with_embeddings = result.scalar()
        
        # Table size
        result = conn.execute(text("""
            SELECT pg_size_pretty(pg_total_relation_size('document_chunks'))
        """))
        table_size = result.scalar()
        
        print(f"\n📈 Table Statistics:")
        print(f"  Total chunks: {total_chunks:,}")
        print(f"  Chunks with embeddings: {chunks_with_embeddings:,}")
        print(f"  Table size: {table_size}")
        
        # Estimate index creation time (very rough: ~1000-5000 chunks/second for HNSW)
        if chunks_with_embeddings > 0:
            est_seconds_min = chunks_with_embeddings / 5000
            est_seconds_max = chunks_with_embeddings / 1000
            print(f"  Estimated index creation time: {est_seconds_min/60:.1f} - {est_seconds_max/60:.1f} minutes")

def create_index(engine):
    """Create the HNSW index with CONCURRENTLY option"""
    print("\n🔨 Creating HNSW index...")
    print("   Using CONCURRENTLY to avoid blocking reads/writes")
    
    # Need to use autocommit mode for CONCURRENTLY
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        try:
            start_time = time.time()
            
            conn.execute(text("""
                CREATE INDEX CONCURRENTLY IF NOT EXISTS document_chunks_embedding_idx 
                ON document_chunks 
                USING hnsw (embedding vector_cosine_ops)
                WITH (m = 16, ef_construction = 64)
            """))
            
            duration = time.time() - start_time
            
            print(f"\n✓ Index created successfully in {duration:.1f} seconds ({duration/60:.2f} minutes)")
            print("  The index will now be used for fast similarity searches")
            
        except Exception as e:
            print(f"\n✗ Error creating index: {e}")
            print("\nTroubleshooting:")
            print("  1. Check if index already exists: python scripts/create_vector_index.py --check")
            print("  2. Check for errors in database logs")
            print("  3. Ensure pgvector extension is installed: CREATE EXTENSION IF NOT EXISTS vector")
            raise

def main():
    parser = argparse.ArgumentParser(description='Manage HNSW vector index on document_chunks')
    parser.add_argument('--check', action='store_true', help='Check if index exists')
    parser.add_argument('--progress', action='store_true', help='Check index creation progress')
    parser.add_argument('--create', action='store_true', help='Create the index with CONCURRENTLY')
    parser.add_argument('--stats', action='store_true', help='Show table statistics')
    
    args = parser.parse_args()
    
    # Get database URL
    db_url = get_database_url()
    if not db_url:
        print("❌ ERROR: DATABASE_URL or AZURE_POSTGRESQL_CONNECTIONSTRING not set")
        sys.exit(1)
    
    # Create engine
    engine = create_engine(db_url)
    
    try:
        # Always show stats first
        get_table_stats(engine)
        
        if args.check:
            print("\n" + "="*60)
            check_index_exists(engine)
        
        if args.progress:
            print("\n" + "="*60)
            check_index_progress(engine)
        
        if args.create:
            print("\n" + "="*60)
            # Check if it exists first
            if check_index_exists(engine):
                print("\n⚠ Index already exists. Skipping creation.")
            else:
                create_index(engine)
        
        # If no args provided, show help
        if not any([args.check, args.progress, args.create, args.stats]):
            parser.print_help()
            print("\n📋 Quick commands:")
            print("  Check status:  python scripts/create_vector_index.py --check")
            print("  Check progress: python scripts/create_vector_index.py --progress")
            print("  Create index:  python scripts/create_vector_index.py --create")
            
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        sys.exit(1)
    finally:
        engine.dispose()

if __name__ == '__main__':
    main()
