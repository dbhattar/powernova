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
  async processDocument(docId, userId, fileName, textContent) {
    await this.initialize();
    
    if (!this.initialized) {
      console.log('⚠️  Vector service not available, skipping document processing');
      return { chunkCount: 0, success: false, message: 'Vector service not available' };
    }

    try {
      console.log('📄 Processing document:', { docId, userId, fileName });
      
      // Chunk the text
      const chunks = this.chunkText(textContent);
      console.log('📝 Generated chunks:', chunks.length);
      
      // Generate embeddings for chunks
      const embeddings = await openaiService.generateEmbeddings(chunks);
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
          text: chunk,
          createdAt: new Date().toISOString()
        }
      }));
      
      console.log('🎯 Prepared vectors for upsert:', vectors.length);

      // Store in Pinecone with user namespace
      await this.index.namespace(userId).upsert(vectors);

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
      // Generate embedding for query
      const queryEmbeddings = await openaiService.generateEmbeddings([query]);
      const queryVector = queryEmbeddings[0];

      // Search in user's namespace
      const searchResponse = await this.index.namespace(userId).query({
        vector: queryVector,
        topK: topK,
        includeMetadata: true
      });

      console.log(`📚 Found ${searchResponse.matches?.length || 0} relevant documents for query`);
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
   * Intelligent text chunking
   */
  chunkText(text, options = {}) {
    const maxTokens = options.maxTokens || 500;
    const overlap = options.overlap || 50;
    
    // Simple sentence-based chunking
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const chunks = [];
    let currentChunk = '';
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      
      // Rough token estimation (1 token ≈ 4 characters)
      if ((currentChunk.length + trimmedSentence.length) * 0.25 > maxTokens) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = trimmedSentence;
      } else {
        currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    // Add overlap between chunks if requested
    if (overlap > 0 && chunks.length > 1) {
      // Implementation for overlapping chunks would go here
      // For now, using simple non-overlapping chunks
    }
    
    return chunks.filter(chunk => chunk.length > 20); // Filter out very short chunks
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
