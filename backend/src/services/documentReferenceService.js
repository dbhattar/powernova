/**
 * DocumentReferenceService
 * Handles formatting and management of document references in chat responses
 */
class DocumentReferenceService {
  /**
   * Process search results and extract document references
   */
  static processSearchResults(searchResults, scoreThreshold = 0.3) {
    if (!searchResults || searchResults.length === 0) {
      return {
        documentContext: '',
        sourceDocuments: [],
        hasReferences: false
      };
    }

    // Filter by relevance threshold
    const relevantResults = searchResults.filter(result => result.score > scoreThreshold);
    
    if (relevantResults.length === 0) {
      return {
        documentContext: '',
        sourceDocuments: [],
        hasReferences: false
      };
    }

    // Build document context for AI
    const documentContext = relevantResults
      .map(result => `Source: ${result.metadata.fileName}\n${result.metadata.text}`)
      .join('\n\n');

    // Extract unique documents with their details
    const documentMap = new Map();
    
    relevantResults.forEach(result => {
      const docId = result.metadata.docId;
      const fileName = result.metadata.fileName;
      const page = result.metadata.page;
      const score = result.score;
      
      if (!documentMap.has(docId)) {
        documentMap.set(docId, {
          id: docId,
          name: fileName,
          pages: new Set(),
          maxScore: score,
          chunks: 1
        });
      } else {
        const doc = documentMap.get(docId);
        doc.maxScore = Math.max(doc.maxScore, score);
        doc.chunks++;
      }
      
      if (page) {
        documentMap.get(docId).pages.add(page);
      }
    });
    
    // Convert to array and sort by relevance
    const sourceDocuments = Array.from(documentMap.values())
      .sort((a, b) => b.maxScore - a.maxScore)
      .map(doc => ({
        id: doc.id,
        name: doc.name,
        pages: Array.from(doc.pages).sort((a, b) => a - b),
        relevanceScore: doc.maxScore,
        chunks: doc.chunks
      }));

    return {
      documentContext,
      sourceDocuments,
      hasReferences: sourceDocuments.length > 0
    };
  }

  /**
   * Format document references for display in chat response
   */
  static formatDocumentReferences(sourceDocuments) {
    if (!sourceDocuments || sourceDocuments.length === 0) {
      return '';
    }

    const references = sourceDocuments.map(doc => {
      const pageRef = doc.pages.length > 0 
        ? ` (p. ${doc.pages.join(', ')})` 
        : '';
      const chunkInfo = doc.chunks > 1 ? ` • ${doc.chunks} sections` : '';
      return `- [${doc.name}${pageRef}](/api/chat/document/${doc.id}${doc.pages.length > 0 ? `?page=${doc.pages[0]}` : ''})${chunkInfo}`;
    });

    return `\n\n**📄 References:**\n${references.join('\n')}`;
  }

  /**
   * Generate reference summary for response metadata
   */
  static generateReferenceSummary(sourceDocuments) {
    if (!sourceDocuments || sourceDocuments.length === 0) {
      return null;
    }

    const totalChunks = sourceDocuments.reduce((sum, doc) => sum + doc.chunks, 0);
    const averageScore = sourceDocuments.reduce((sum, doc) => sum + doc.relevanceScore, 0) / sourceDocuments.length;

    return {
      documentCount: sourceDocuments.length,
      totalChunks,
      averageRelevanceScore: averageScore,
      topDocument: sourceDocuments[0]?.name
    };
  }
}

module.exports = DocumentReferenceService;
