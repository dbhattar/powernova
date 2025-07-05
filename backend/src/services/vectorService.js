const { PineconeClient } = require('@pinecone-database/pinecone');
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
      this.pinecone = new PineconeClient();
      
      await this.pinecone.init({
        apiKey: process.env.PINECONE_API_KEY,
        environment: process.env.PINECONE_ENVIRONMENT,
      });

      this.index = this.pinecone.Index(process.env.PINECONE_INDEX_NAME || 'powernova-docs');
      this.initialized = true;
      
      console.log('Vector service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize vector service:', error);
      throw error;
    }
  }

  /**
   * Process document: chunk text, generate embeddings, and store in vector DB
   */
  async processDocument(docId, userId, fileName, textContent) {
    await this.initialize();

    try {
      // Chunk the text
      const chunks = this.chunkText(textContent);
      
      // Generate embeddings for chunks
      const embeddings = await openaiService.generateEmbeddings(chunks);

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

      // Store in Pinecone with user namespace
      await this.index.upsert({
        upsertRequest: {
          vectors: vectors,
          namespace: userId
        }
      });

      console.log(`Processed document ${docId}: ${chunks.length} chunks`);
      
      return {
        chunkCount: chunks.length,
        success: true
      };

    } catch (error) {
      console.error('Document processing error:', error);
      throw new Error(`Failed to process document: ${error.message}`);
    }
  }

  /**
   * Search for relevant document chunks
   */
  async searchDocuments(userId, query, topK = 10) {
    await this.initialize();

    try {
      // Generate embedding for query
      const queryEmbeddings = await openaiService.generateEmbeddings([query]);
      const queryVector = queryEmbeddings[0];

      // Search in user's namespace
      const searchResponse = await this.index.query({
        queryRequest: {
          vector: queryVector,
          topK: topK,
          namespace: userId,
          includeMetadata: true
        }
      });

      return searchResponse.matches || [];

    } catch (error) {
      console.error('Vector search error:', error);
      throw new Error(`Document search failed: ${error.message}`);
    }
  }

  /**
   * Delete document vectors
   */
  async deleteDocument(docId, userId) {
    await this.initialize();

    try {
      // Get all chunk IDs for this document
      const chunkIds = [];
      let fetchMore = true;
      let paginationToken = null;

      while (fetchMore) {
        const fetchResponse = await this.index.fetch({
          ids: [], // Will be populated by filter
          namespace: userId
        });

        // Filter by docId in metadata
        for (const [id, vector] of Object.entries(fetchResponse.vectors || {})) {
          if (vector.metadata?.docId === docId) {
            chunkIds.push(id);
          }
        }

        fetchMore = false; // Simplified for now
      }

      if (chunkIds.length > 0) {
        await this.index._delete({
          deleteRequest: {
            ids: chunkIds,
            namespace: userId
          }
        });
      }

      console.log(`Deleted ${chunkIds.length} vectors for document ${docId}`);
      
      return { deletedCount: chunkIds.length };

    } catch (error) {
      console.error('Vector deletion error:', error);
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

    try {
      const stats = await this.index.describeIndexStats({
        describeIndexStatsRequest: {}
      });

      // Get namespace-specific stats
      const namespaceStats = stats.namespaces?.[userId];
      
      return {
        totalVectors: namespaceStats?.vectorCount || 0,
        indexDimension: stats.dimension || 0
      };

    } catch (error) {
      console.error('Stats retrieval error:', error);
      return { totalVectors: 0, indexDimension: 0 };
    }
  }
}

module.exports = new VectorService();
