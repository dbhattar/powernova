"""
Test script to verify search is now working with DocumentChunk embeddings
"""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from models.document import Document, DocumentStatus
from models.document_chunk import DocumentChunk

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
    
    print("\n" + "="*60)
    print("SEARCH FIX VERIFICATION")
    print("="*60)
    
    # Check document chunks with embeddings
    print("\n1. DocumentChunk embedding status:")
    
    total_chunks = db.query(DocumentChunk).count()
    print(f"   Total chunks: {total_chunks:,}")
    
    chunks_with_embedding = db.query(DocumentChunk).filter(
        DocumentChunk.embedding.isnot(None)
    ).count()
    print(f"   Chunks with embedding NOT NULL: {chunks_with_embedding:,}")
    
    chunks_generated_true = db.query(DocumentChunk).filter(
        DocumentChunk.embedding_generated == True
    ).count()
    print(f"   Chunks with embedding_generated=True: {chunks_generated_true:,}")
    
    # Searchable chunks (what the search API will find)
    searchable_chunks = db.query(DocumentChunk).filter(
        DocumentChunk.embedding_generated == True,
        DocumentChunk.embedding.isnot(None)
    ).count()
    print(f"\n2. Searchable chunks (embedding_generated=True AND embedding NOT NULL):")
    print(f"   {searchable_chunks:,} chunks")
    
    if searchable_chunks == 0:
        print("\n   ⚠️  WARNING: No searchable chunks found!")
        print("   The search will still return 0 results.")
        print("\n   Possible issues:")
        print("   - Embeddings haven't been generated yet")
        print("   - Embedding generation failed")
        print("   - Need to run embedding worker")
    else:
        print(f"\n   ✅ SUCCESS: Found {searchable_chunks:,} searchable chunks!")
        
        # Show sample chunks
        print("\n3. Sample of searchable chunks:")
        samples = db.query(
            DocumentChunk, Document
        ).join(
            Document, DocumentChunk.document_id == Document.id
        ).filter(
            DocumentChunk.embedding_generated == True,
            DocumentChunk.embedding.isnot(None),
            Document.status == DocumentStatus.COMPLETED
        ).limit(3).all()
        
        for chunk, doc in samples:
            print(f"\n   Chunk ID: {chunk.id}")
            print(f"   Document: {doc.title or 'Untitled'}")
            print(f"   URL: {doc.url[:60]}...")
            print(f"   Content preview: {chunk.content[:100]}...")
            print(f"   Word count: {chunk.word_count}")
    
    # Check documents with completed chunks
    print("\n4. Documents with searchable chunks:")
    docs_with_chunks = db.query(Document).join(
        DocumentChunk, Document.id == DocumentChunk.document_id
    ).filter(
        DocumentChunk.embedding_generated == True,
        DocumentChunk.embedding.isnot(None),
        Document.status == DocumentStatus.COMPLETED
    ).distinct().count()
    
    print(f"   {docs_with_chunks:,} documents have searchable chunks")
    
    db.close()
    engine.dispose()
    
    print("\n" + "="*60)
    if searchable_chunks > 0:
        print("✅ SEARCH SHOULD NOW WORK!")
    else:
        print("⚠️  SEARCH STILL NEEDS EMBEDDING GENERATION")
    print("="*60)

if __name__ == "__main__":
    main()
