"""
Debug script to check document URL values
"""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from models.document import Document, DocumentStatus

def get_database_url():
    """Get database URL from environment variables"""
    return os.getenv('DATABASE_URL') or os.getenv('AZURE_POSTGRESQL_CONNECTIONSTRING')

def main():
    db_url = get_database_url()
    if not db_url:
        print("❌ ERROR: DATABASE_URL or AZURE_POSTGRESQL_CONNECTIONSTRING not set")
        return
    
    print("🔗 Connecting to database...")
    
    engine = create_engine(db_url)
    db = Session(engine)
    
    print("\n" + "="*80)
    print("DOCUMENT URL ANALYSIS")
    print("="*80)
    
    # Get sample of documents
    print("\n1. Sample document URLs:")
    docs = db.query(Document).filter(
        Document.status == DocumentStatus.COMPLETED
    ).limit(10).all()
    
    for doc in docs:
        print(f"\n   Document ID: {doc.id}")
        print(f"   Title: {doc.title}")
        print(f"   URL: {doc.url}")
        print(f"   Blob URL: {doc.blob_url}")
        print(f"   File Path: {doc.file_path}")
        
        # Check if URL looks like a blob storage URL
        if doc.url and 'blob.core.windows.net' in doc.url:
            print(f"   ⚠️  WARNING: URL appears to be a blob storage path!")
        elif doc.url and doc.url.startswith('http'):
            print(f"   ✓ URL looks like original source URL")
    
    # Check how many have blob URLs in the url field
    print("\n2. Checking for misplaced blob URLs:")
    blob_in_url = db.query(Document).filter(
        Document.url.like('%blob.core.windows.net%')
    ).count()
    
    total_docs = db.query(Document).filter(
        Document.status == DocumentStatus.COMPLETED
    ).count()
    
    print(f"   Total COMPLETED documents: {total_docs:,}")
    print(f"   Documents with blob URL in 'url' field: {blob_in_url:,}")
    
    if blob_in_url > 0:
        print(f"\n   ⚠️  {blob_in_url:,} documents have Azure blob URLs in the 'url' field")
        print(f"   This should contain the original source URL, not the blob storage path")
    
    # Check metadata for original URLs
    print("\n3. Checking doc_metadata for original URLs:")
    docs_with_metadata = db.query(Document).filter(
        Document.status == DocumentStatus.COMPLETED
    ).limit(5).all()
    
    found_metadata = False
    for doc in docs_with_metadata:
        if doc.doc_metadata and len(doc.doc_metadata) > 0:
            if not found_metadata:
                print(f"\n   Sample metadata from document {doc.id}:")
                print(f"   Metadata keys: {list(doc.doc_metadata.keys())}")
                print(f"   Full metadata: {doc.doc_metadata}")
                found_metadata = True
                
                if 'source_url' in doc.doc_metadata:
                    print(f"   ✓ Found 'source_url' in metadata: {doc.doc_metadata['source_url']}")
                if 'original_url' in doc.doc_metadata:
                    print(f"   ✓ Found 'original_url' in metadata: {doc.doc_metadata['original_url']}")
                if 'url' in doc.doc_metadata:
                    print(f"   ✓ Found 'url' in metadata: {doc.doc_metadata['url']}")
                break
    
    if not found_metadata:
        print(f"   No documents found with non-empty metadata in first 5 results")
    
    # Show actual URL examples
    print("\n4. Sample actual URLs from search results:")
    sample_docs = db.query(Document).filter(
        Document.status == DocumentStatus.COMPLETED
    ).limit(3).all()
    
    for doc in sample_docs:
        print(f"\n   Document ID: {doc.id}")
        print(f"   Title: {doc.title[:80] if doc.title else 'No title'}...")
        print(f"   URL field: {doc.url}")
        print(f"   Blob URL field: {doc.blob_url if doc.blob_url else 'None'}")
        
        # Determine what looks like the source URL
        if doc.url and not 'blob.core.windows.net' in doc.url:
            print(f"   → Should use: URL field (original source)")
        elif doc.blob_url:
            print(f"   → Currently using blob storage URL in 'url' field")
    
    db.close()
    engine.dispose()
    
    print("\n" + "="*80)

if __name__ == "__main__":
    main()
