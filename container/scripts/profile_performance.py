#!/usr/bin/env python3
"""
Performance profiling tool for chat response generation.
Identifies bottlenecks in the RAG pipeline.
"""

import os
import time
import asyncio
from sqlalchemy import create_engine, text
from datetime import datetime

def get_database_url():
    """Get database URL from environment variables"""
    return os.getenv('DATABASE_URL') or os.getenv('AZURE_POSTGRESQL_CONNECTIONSTRING')

async def profile_similarity_search(engine, query_text="What is machine learning?", top_k=5):
    """Profile the similarity search performance"""
    
    print("\n" + "="*70)
    print("🔍 SIMILARITY SEARCH PROFILING")
    print("="*70)
    
    # First, we need to generate an embedding for the query
    # Since we don't have the embedding generation here, we'll test with a sample query
    
    with engine.connect() as conn:
        # Test 1: Check if index exists and is being used
        print("\n1️⃣  Checking index status...")
        result = conn.execute(text("""
            SELECT 
                schemaname,
                tablename,
                indexname,
                pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
            FROM pg_indexes 
            WHERE indexname = 'document_chunks_embedding_idx'
        """))
        
        row = result.fetchone()
        if row:
            print(f"   ✓ Index exists: {row[2]}")
            print(f"   ✓ Index size: {row[3]}")
        else:
            print("   ✗ Index NOT found!")
            return
        
        # Test 2: Count chunks with embeddings
        print("\n2️⃣  Checking data availability...")
        start = time.time()
        result = conn.execute(text("""
            SELECT COUNT(*) 
            FROM document_chunks 
            WHERE embedding IS NOT NULL
        """))
        count = result.scalar()
        duration = time.time() - start
        print(f"   ✓ Chunks with embeddings: {count:,}")
        print(f"   ⏱  Count query time: {duration*1000:.1f}ms")
        
        # Test 3: Simple similarity search with EXPLAIN ANALYZE
        print("\n3️⃣  Testing similarity search performance...")
        
        # Generate a random embedding vector for testing
        result = conn.execute(text("""
            SELECT embedding 
            FROM document_chunks 
            WHERE embedding IS NOT NULL 
            LIMIT 1
        """))
        sample_embedding = result.fetchone()[0]
        
        # Run EXPLAIN ANALYZE to see query plan
        print("\n   📊 Query Execution Plan:")
        
        # Convert embedding to string format for SQL
        embedding_str = str(sample_embedding).replace("'", "''")
        
        explain_query = f"""
            EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
            SELECT 
                id,
                content,
                embedding <=> '{embedding_str}'::vector AS distance
            FROM document_chunks
            WHERE embedding IS NOT NULL
            ORDER BY embedding <=> '{embedding_str}'::vector
            LIMIT {top_k}
        """
        
        result = conn.execute(text(explain_query))
        
        for row in result:
            print(f"   {row[0]}")
        
        # Test 4: Actual timed similarity search
        print("\n4️⃣  Running timed similarity search...")
        
        search_query = f"""
            SELECT 
                id,
                content,
                embedding <=> '{embedding_str}'::vector AS distance
            FROM document_chunks
            WHERE embedding IS NOT NULL
            ORDER BY embedding <=> '{embedding_str}'::vector
            LIMIT {top_k}
        """
        
        start = time.time()
        result = conn.execute(text(search_query))
        
        chunks = result.fetchall()
        duration = time.time() - start
        
        print(f"   ✓ Retrieved {len(chunks)} chunks")
        print(f"   ⏱  Search time: {duration*1000:.1f}ms")
        
        if duration > 1.0:
            print(f"   ⚠  SLOW! Expected < 100ms, got {duration*1000:.1f}ms")
        elif duration > 0.1:
            print(f"   ⚠  Acceptable but could be faster")
        else:
            print(f"   ✓ FAST! Excellent performance")
        
        # Test 5: Check index usage statistics
        print("\n5️⃣  Checking index usage statistics...")
        result = conn.execute(text("""
            SELECT 
                idx_scan as index_scans,
                idx_tup_read as tuples_read,
                idx_tup_fetch as tuples_fetched
            FROM pg_stat_user_indexes
            WHERE indexrelname = 'document_chunks_embedding_idx'
        """))
        
        row = result.fetchone()
        if row:
            print(f"   ✓ Index scans: {row[0]:,}")
            print(f"   ✓ Tuples read: {row[1]:,}")
            print(f"   ✓ Tuples fetched: {row[2]:,}")
            
            if row[0] == 0:
                print("   ⚠  Index has never been used! Check query plans")
        
        return duration

async def profile_llm_call():
    """Profile LLM API call performance"""
    
    print("\n" + "="*70)
    print("🤖 LLM API CALL PROFILING")
    print("="*70)
    
    import aiohttp
    
    # Get API key
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        print("   ✗ OPENAI_API_KEY not set, skipping LLM test")
        return None
    
    print("\n1️⃣  Testing OpenAI API latency...")
    
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Say 'test' and nothing else."}
        ],
        "max_tokens": 10,
        "stream": False
    }
    
    start = time.time()
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    duration = time.time() - start
                    
                    print(f"   ✓ API call successful")
                    print(f"   ⏱  Response time: {duration*1000:.1f}ms")
                    
                    if duration > 2.0:
                        print(f"   ⚠  SLOW! Expected < 1s, got {duration:.1f}s")
                    else:
                        print(f"   ✓ Normal latency")
                    
                    return duration
                else:
                    print(f"   ✗ API error: {response.status}")
                    return None
    except Exception as e:
        print(f"   ✗ Error: {e}")
        return None

async def profile_embedding_generation():
    """Profile embedding generation performance"""
    
    print("\n" + "="*70)
    print("🔤 EMBEDDING GENERATION PROFILING")
    print("="*70)
    
    import aiohttp
    
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        print("   ✗ OPENAI_API_KEY not set, skipping embedding test")
        return None
    
    print("\n1️⃣  Testing embedding API latency...")
    
    url = "https://api.openai.com/v1/embeddings"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "text-embedding-3-small",
        "input": "What is machine learning?"
    }
    
    start = time.time()
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    duration = time.time() - start
                    
                    print(f"   ✓ Embedding generated successfully")
                    print(f"   ⏱  Generation time: {duration*1000:.1f}ms")
                    
                    if duration > 0.5:
                        print(f"   ⚠  SLOW! Expected < 200ms, got {duration*1000:.1f}ms")
                    else:
                        print(f"   ✓ Fast embedding generation")
                    
                    return duration
                else:
                    print(f"   ✗ API error: {response.status}")
                    return None
    except Exception as e:
        print(f"   ✗ Error: {e}")
        return None

async def profile_full_pipeline():
    """Profile the complete RAG pipeline"""
    
    print("\n" + "="*70)
    print("⚡ FULL PIPELINE PROFILING")
    print("="*70)
    
    db_url = get_database_url()
    if not db_url:
        print("❌ ERROR: DATABASE_URL not set")
        return
    
    engine = create_engine(db_url)
    
    timings = {}
    
    # 1. Embedding generation
    embed_time = await profile_embedding_generation()
    if embed_time:
        timings['embedding'] = embed_time
    
    # 2. Similarity search
    search_time = await profile_similarity_search(engine)
    if search_time:
        timings['similarity_search'] = search_time
    
    # 3. LLM call
    llm_time = await profile_llm_call()
    if llm_time:
        timings['llm_call'] = llm_time
    
    # Summary
    print("\n" + "="*70)
    print("📊 PERFORMANCE SUMMARY")
    print("="*70)
    
    if timings:
        total = sum(timings.values())
        
        print(f"\n⏱  Total estimated time: {total*1000:.1f}ms ({total:.2f}s)")
        print(f"\nBreakdown:")
        
        for component, duration in timings.items():
            percentage = (duration / total) * 100
            bar_length = int(percentage / 2)
            bar = "█" * bar_length + "░" * (50 - bar_length)
            
            print(f"  {component:20s} {bar} {duration*1000:6.1f}ms ({percentage:5.1f}%)")
        
        # Identify bottleneck
        bottleneck = max(timings, key=timings.get)
        print(f"\n🎯 PRIMARY BOTTLENECK: {bottleneck} ({timings[bottleneck]*1000:.1f}ms)")
        
        # Recommendations
        print(f"\n💡 RECOMMENDATIONS:")
        
        if timings.get('similarity_search', 0) > 0.1:
            print(f"   • Similarity search is slow ({timings['similarity_search']*1000:.1f}ms)")
            print(f"     - Check if HNSW index is being used (see query plan above)")
            print(f"     - Consider increasing PostgreSQL shared_buffers")
            print(f"     - Verify network latency to database")
        
        if timings.get('embedding', 0) > 0.5:
            print(f"   • Embedding generation is slow ({timings['embedding']*1000:.1f}ms)")
            print(f"     - Consider caching embeddings for common queries")
            print(f"     - Check network latency to OpenAI API")
        
        if timings.get('llm_call', 0) > 2.0:
            print(f"   • LLM call is slow ({timings['llm_call']*1000:.1f}ms)")
            print(f"     - This is streaming, actual perceived time may be faster")
            print(f"     - First token latency is what matters for user experience")
    
    engine.dispose()

async def main():
    print("\n" + "="*70)
    print("🔬 PowerNOVA Performance Profiler")
    print("="*70)
    print(f"Timestamp: {datetime.now()}")
    
    await profile_full_pipeline()
    
    print("\n" + "="*70)
    print("✅ Profiling complete!")
    print("="*70)

if __name__ == '__main__':
    asyncio.run(main())
