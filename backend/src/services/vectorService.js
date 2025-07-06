const { Pinecone } = require('@pinecone-database/pinecone');
const openaiService = require('./openaiService');

class VectorService {
  constructor() {
    this.pinecone = null;
    this.index = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Validate required environment variables
      if (!process.env.PINECONE_API_KEY) {
        throw new Error('PINECONE_API_KEY environment variable is required');
      }

      const indexName = process.env.PINECONE_INDEX_NAME || 'powernova-docs';
      console.log('🔧 Initializing Pinecone with latest SDK...');
      console.log('📋 Index name:', indexName);
      
      // Use the new simplified Pinecone initialization (API version 2025-04)
      this.pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY
      });

      this.index = this.pinecone.index(indexName);
      
      // Test the connection and get index info
      const stats = await this.index.describeIndexStats();
      console.log('📊 Index stats:', JSON.stringify(stats, null, 2));
      
      this.initialized = true;
      console.log('✅ Vector service initialized successfully');
      console.log('📐 Index dimension:', stats.dimension);
      
    } catch (error) {
      console.error('❌ Failed to initialize vector service:', error.message);
      console.log('📝 Vector search will be disabled. App will continue without document context.');
      
      // Don't throw error - let the app continue without vector search
      this.initialized = false;
      this.pinecone = null;
      this.index = null;
    }
  }

  /**
   * Process document: chunk text, generate embeddings, and store in vector DB
   */
  async processDocument(docId, userId, fileName, textContent, chunkParams = null) {
    await this.initialize();
    
    if (!this.initialized) {
      console.log('⚠️  Vector service not available, skipping document processing');
      return { chunkCount: 0, success: false, message: 'Vector service not available' };
    }

    try {
      console.log('📄 Processing document:', { docId, userId, fileName });
      console.log(`📊 Document stats: ${textContent.length} characters, ~${Math.ceil(textContent.length / 4)} tokens`);
      
      // Use provided chunk parameters or calculate optimal ones
      const { chunkSize, overlap } = chunkParams || this.calculateOptimalChunkSize(textContent);
      console.log(`⚙️ Using chunk parameters: size=${chunkSize}, overlap=${overlap}`);
      
      // Chunk the text with better algorithm
      const chunks = this.chunkText(textContent, chunkSize, overlap);
      console.log('📝 Generated chunks:', chunks.length);
      
      // Generate embeddings in batches to avoid token limits
      const embeddings = await this.generateEmbeddingsInBatches(chunks, 50);
      console.log('🧠 Generated embeddings:', embeddings.length);
      console.log('📐 Embedding dimensions:', embeddings[0] ? embeddings[0].length : 'none');

      // Prepare vectors for upsert
      const vectors = chunks.map((chunk, index) => ({
        id: `${docId}_chunk_${index}`,
        values: embeddings[index],
        metadata: {
          docId: docId,
          userId: userId,
          fileName: fileName,
          chunkIndex: index,
          totalChunks: chunks.length,
          text: chunk,
          wordCount: chunk.split(/\s+/).length,
          type: 'document',
          createdAt: new Date().toISOString()
        }
      }));
      
      console.log('🎯 Prepared vectors for upsert:', vectors.length);

      // Store in Pinecone with batching
      await this.upsertVectors(vectors, userId);

      console.log(`✅ Processed document ${docId}: ${chunks.length} chunks`);
      
      return {
        chunkCount: chunks.length,
        success: true
      };

    } catch (error) {
      console.error('❌ Document processing error:', error);
      throw new Error(`Failed to process document: ${error.message}`);
    }
  }

  /**
   * Search for relevant document chunks
   */
  async searchDocuments(userId, query, topK = 10) {
    await this.initialize();
    
    if (!this.initialized) {
      console.log('⚠️  Vector service not available, returning empty search results');
      return [];
    }

    try {
      console.log(`🔍 Starting document search for user: ${userId}`);
      console.log(`🔍 Query: "${query}"`);
      console.log(`🔍 Requesting top ${topK} results`);

      // Generate embedding for query
      const queryEmbeddings = await openaiService.generateEmbeddings([query]);
      const queryVector = queryEmbeddings[0];
      
      console.log(`🧠 Generated query embedding with ${queryVector ? queryVector.length : 0} dimensions`);

      // Search in user's namespace
      console.log(`🔍 Searching in namespace: ${userId}`);
      const searchResponse = await this.index.namespace(userId).query({
        vector: queryVector,
        topK: topK,
        includeMetadata: true
      });

      console.log(`📚 Search response:`, {
        matchesFound: searchResponse.matches?.length || 0,
        namespace: searchResponse.namespace,
        usage: searchResponse.usage
      });

      if (searchResponse.matches && searchResponse.matches.length > 0) {
        console.log(`📋 Match details:`);
        searchResponse.matches.forEach((match, index) => {
          console.log(`   ${index + 1}. ID: ${match.id}, Score: ${match.score?.toFixed(4)}, File: ${match.metadata?.fileName}`);
        });
      } else {
        console.log('❌ No matches found in vector search');
        
        // Debug: Check if namespace has any vectors
        try {
          const stats = await this.index.describeIndexStats();
          console.log(`📊 Index stats:`, {
            totalVectors: stats.totalVectorCount,
            namespaces: Object.keys(stats.namespaces || {}),
            userNamespaceVectors: stats.namespaces?.[userId]?.vectorCount || 0
          });
        } catch (statsError) {
          console.log(`⚠️ Could not get index stats:`, statsError.message);
        }
      }

      return searchResponse.matches || [];

    } catch (error) {
      console.error('❌ Vector search error:', error);
      console.log('📝 Returning empty results, chat will continue without document context');
      return [];
    }
  }

  /**
   * Delete document vectors
   */
  async deleteDocument(docId, userId) {
    await this.initialize();
    
    if (!this.initialized) {
      console.log('⚠️  Vector service not available, skipping document deletion');
      return { success: false, message: 'Vector service not available' };
    }

    try {
      // Generate potential vector IDs based on the pattern we use
      const vectorIds = [];
      for (let i = 0; i < 100; i++) { // Assume max 100 chunks per document
        vectorIds.push(`${docId}_chunk_${i}`);
      }
      
      console.log(`🗑️  Attempting to delete up to 100 chunk IDs for document ${docId}`);
      
      // Delete by IDs (this won't fail if IDs don't exist)
      await this.index.namespace(userId).deleteMany(vectorIds);
      
      console.log(`🗑️  Completed deletion for document ${docId}`);
      
      return { success: true };

    } catch (error) {
      console.error('❌ Vector deletion error:', error);
      throw new Error(`Failed to delete document vectors: ${error.message}`);
    }
  }

  /**
   * Calculate optimal chunk size based on document size
   */
  calculateOptimalChunkSize(textContent) {
    const totalChars = textContent.length;
    const estimatedTokens = Math.ceil(totalChars / 4);
    
    console.log(`📊 Document analysis: ${totalChars.toLocaleString()} chars, ~${estimatedTokens.toLocaleString()} tokens`);
    
    // Aim for chunks that are small enough to process efficiently
    // but large enough to maintain context
    if (estimatedTokens > 3000000) {
      // Very large documents (> 3M tokens)
      return { chunkSize: 2000, overlap: 400 }; // Larger chunks for very large docs
    } else if (estimatedTokens > 1500000) {
      // Large documents (1.5M - 3M tokens) 
      return { chunkSize: 1800, overlap: 350 }; // Large chunks
    } else if (estimatedTokens > 1000000) {
      // Medium-large documents (1M - 1.5M tokens)
      return { chunkSize: 1500, overlap: 300 }; // Medium-large chunks
    } else if (estimatedTokens > 500000) {
      // Medium documents (500k - 1M tokens)
      return { chunkSize: 1200, overlap: 250 }; // Medium chunks
    } else {
      // Small documents (< 500k tokens)
      return { chunkSize: 1000, overlap: 200 }; // Standard chunks
    }
  }

  /**
   * Enhanced text chunking with sentence boundary detection and overlap
   */
  chunkText(text, chunkSize = 1000, overlap = 200) {
    const chunks = [];
    let start = 0;
    
    // Split into sentences first for better chunking
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let currentChunk = '';
    let currentSize = 0;
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      const sentenceSize = trimmedSentence.length;
      
      // If adding this sentence would exceed chunk size, save current chunk
      if (currentSize + sentenceSize > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        
        // Start new chunk with overlap from previous chunk
        if (overlap > 0 && currentChunk.length > overlap) {
          const overlapText = currentChunk.slice(-overlap);
          currentChunk = overlapText + '. ' + trimmedSentence;
          currentSize = overlapText.length + trimmedSentence.length + 2;
        } else {
          currentChunk = trimmedSentence;
          currentSize = sentenceSize;
        }
      } else {
        currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
        currentSize += sentenceSize + (currentChunk ? 2 : 0);
      }
    }
    
    // Add the last chunk
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    // Filter out very short chunks
    const filteredChunks = chunks.filter(chunk => chunk.length > 50);
    console.log(`📝 Chunking result: ${chunks.length} raw chunks, ${filteredChunks.length} after filtering`);
    
    return filteredChunks;
  }

  /**
   * Estimate token count for text (approximate)
   */
  estimateTokenCount(text) {
    // Rough estimation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Generate embeddings in batches to avoid token limits
   */
  async generateEmbeddingsInBatches(chunks, batchSize = 40) {
    const allEmbeddings = [];
    const maxTokensPerBatch = 240000; // Leave more buffer below 300k OpenAI limit for very large docs
    
    console.log(`🔄 Starting batch embedding generation for ${chunks.length} chunks`);
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      // Create batch, respecting token limits
      let batch = [];
      let batchTokens = 0;
      
      for (let j = i; j < Math.min(i + batchSize, chunks.length); j++) {
        const chunkTokens = this.estimateTokenCount(chunks[j]);
        
        if (batchTokens + chunkTokens > maxTokensPerBatch && batch.length > 0) {
          break; // This batch is full
        }
        
        batch.push(chunks[j]);
        batchTokens += chunkTokens;
      }
      
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(chunks.length / batchSize);
      console.log(`🔄 Processing embedding batch ${batchNumber}/${totalBatches} (${batch.length} chunks, ~${batchTokens.toLocaleString()} tokens)`);
      
      try {
        const batchEmbeddings = await openaiService.generateEmbeddings(batch);
        allEmbeddings.push(...batchEmbeddings);
        
        // Longer delay between batches for large documents to avoid rate limiting
        const delay = batchTokens > 200000 ? 500 : 200;
        await new Promise(resolve => setTimeout(resolve, delay));
        
      } catch (error) {
        console.error(`❌ Batch embedding failed for batch starting at ${i}:`, error);
        throw error;
      }
      
      // Adjust i to account for actual batch size processed
      i += batch.length - batchSize;
    }
    
    console.log(`✅ Generated ${allEmbeddings.length} embeddings total`);
    return allEmbeddings;
  }

  /**
   * Upsert vectors in batches to Pinecone
   */
  async upsertVectors(vectors, userId) {
    const batchSize = 100; // Pinecone batch size limit
    
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      console.log(`📤 Upserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(vectors.length / batchSize)} (${batch.length} vectors)`);
      
      try {
        await this.index.namespace(userId).upsert(batch);
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Vector upsert failed for batch starting at ${i}:`, error);
        throw error;
      }
    }
    
    console.log(`✅ Upserted ${vectors.length} vectors to Pinecone`);
  }

  /**
   * Validate document for processing
   */
  validateDocumentForProcessing(textContent, fileName) {
    const maxFileSize = 200 * 1024 * 1024; // 200MB in characters (increased)
    const maxTokens = 5000000; // 5M tokens (increased for large documents with robust batching)
    
    // Check character count
    if (textContent.length > maxFileSize) {
      throw new Error(`Document too large: ${textContent.length} characters, max ${maxFileSize}`);
    }
    
    // Estimate token count
    const estimatedTokens = this.estimateTokenCount(textContent);
    if (estimatedTokens > maxTokens) {
      throw new Error(`Document has too many tokens: ~${estimatedTokens} tokens, max ${maxTokens}`);
    }
    
    // Check minimum content
    if (textContent.trim().length < 50) {
      throw new Error('Document appears to be empty or too short for processing');
    }
    
    console.log(`✅ Document validation passed: ${estimatedTokens.toLocaleString()} tokens, ${textContent.length.toLocaleString()} characters`);
    
    return {
      valid: true,
      characterCount: textContent.length,
      estimatedTokens,
      fileName
    };
  }

  /**
   * Get document statistics
   */
  async getDocumentStats(userId) {
    await this.initialize();
    
    if (!this.initialized) {
      console.log('⚠️  Vector service not available, returning default stats');
      return { totalVectors: 0, indexDimension: 0, available: false };
    }

    try {
      const stats = await this.index.describeIndexStats();

      // Get namespace-specific stats
      const namespaceStats = stats.namespaces?.[userId];
      
      return {
        totalVectors: namespaceStats?.vectorCount || 0,
        indexDimension: stats.dimension || 0,
        available: true
      };

    } catch (error) {
      console.error('❌ Stats retrieval error:', error);
      return { totalVectors: 0, indexDimension: 0, available: false };
    }
  }

  /**
   * Check if vector service is available
   */
  isAvailable() {
    return this.initialized && this.pinecone && this.index;
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      available: this.isAvailable(),
      hasApiKey: !!process.env.PINECONE_API_KEY,
      indexName: process.env.PINECONE_INDEX_NAME || 'powernova-docs',
      sdkVersion: '2025-04'
    };
  }
}

module.exports = new VectorService();
