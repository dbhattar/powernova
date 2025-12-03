"""
Debug script to check why search is returning 0 documents
"""
import sys
import os

# Add api directory to path
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from models.document import Document, DocumentStatus

def get_database_url():
    """Get database URL from environment variables"""
    return os.getenv('DATABASE_URL') or os.getenv('AZURE_POSTGRESQL_CONNECTIONSTRING')

def main():
    db_url = get_database_url()
    if not db_url:
        print("❌ ERROR: DATABASE_URL or AZURE_POSTGRESQL_CONNECTIONSTRING not set")
        print("\nPlease set one of these environment variables:")
        print("  export DATABASE_URL='postgresql://...'")
        print("  export AZURE_POSTGRESQL_CONNECTIONSTRING='postgresql://...'")
        return
    
    print(f"🔗 Connecting to database...")
    print(f"   URL: {db_url[:30]}...{db_url[-20:]}")
    
    engine = create_engine(db_url)
    db = Session(engine)
    
    print("=" * 60)
    print("DOCUMENT DATABASE DIAGNOSTIC")
    print("=" * 60)
    
    # Total documents
    total_docs = db.query(Document).count()
    print(f"\n1. Total documents in database: {total_docs}")
    
    # Documents by status
    print("\n2. Documents by status:")
    for status in DocumentStatus:
        count = db.query(Document).filter(Document.status == status).count()
        print(f"   {status.value}: {count}")
    
    # Documents with embeddings
    print("\n3. Embedding status:")
    embedding_generated_true = db.query(Document).filter(
        Document.embedding_generated == True
    ).count()
    print(f"   embedding_generated=True: {embedding_generated_true}")
    
    embedding_not_null = db.query(Document).filter(
        Document.embedding.isnot(None)
    ).count()
    print(f"   embedding IS NOT NULL: {embedding_not_null}")
    
    # Documents that should be searchable
    searchable = db.query(Document).filter(
        Document.status == DocumentStatus.COMPLETED,
        Document.embedding_generated == True,
        Document.embedding.isnot(None)
    ).count()
    print(f"\n4. Searchable documents (COMPLETED + embedding_generated + embedding NOT NULL): {searchable}")
    
    # Sample documents
    print("\n5. Sample of first 5 documents:")
    samples = db.query(Document).limit(5).all()
    for doc in samples:
        print(f"\n   Document ID: {doc.id}")
        print(f"   URL: {doc.url[:80]}...")
        print(f"   Title: {doc.title}")
        print(f"   Status: {doc.status.value}")
        print(f"   embedding_generated: {doc.embedding_generated}")
        print(f"   embedding is None: {doc.embedding is None}")
        print(f"   chunk_count: {doc.chunk_count}")
    
    # Check completed docs without embeddings
    completed_no_embedding = db.query(Document).filter(
        Document.status == DocumentStatus.COMPLETED,
        Document.embedding.is_(None)
    ).count()
    print(f"\n6. COMPLETED documents WITHOUT embeddings: {completed_no_embedding}")
    
    if completed_no_embedding > 0:
        print("\n   Sample of COMPLETED docs without embeddings:")
        samples = db.query(Document).filter(
            Document.status == DocumentStatus.COMPLETED,
            Document.embedding.is_(None)
        ).limit(3).all()
        for doc in samples:
            print(f"\n   Document ID: {doc.id}")
            print(f"   URL: {doc.url[:80]}...")
            print(f"   embedding_generated: {doc.embedding_generated}")
            print(f"   chunk_count: {doc.chunk_count}")
            print(f"   content length: {len(doc.content) if doc.content else 0}")
    
    # Test embedding service
    print("\n7. Testing embedding service:")
    try:
        import aiohttp
        import asyncio
        
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            print("   ✗ OPENAI_API_KEY not set - cannot test embedding generation")
        else:
            async def test_embedding():
                url = "https://api.openai.com/v1/embeddings"
                headers = {
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": "text-embedding-3-small",
                    "input": "energy market"
                }
                async with aiohttp.ClientSession() as session:
                    async with session.post(url, json=payload, headers=headers) as response:
                        if response.status == 200:
                            data = await response.json()
                            embedding = data['data'][0]['embedding']
                            return embedding
                        else:
                            return None
            
            test_embedding_result = asyncio.run(test_embedding())
            if test_embedding_result:
                print(f"   ✓ Embedding service working")
                print(f"   ✓ Test embedding dimension: {len(test_embedding_result)}")
            else:
                print(f"   ✗ Embedding service returned None")
    except Exception as e:
        print(f"   ✗ Embedding service error: {e}")
    
    db.close()
    engine.dispose()

if __name__ == "__main__":
    main()
