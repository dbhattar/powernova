const express = require('express');
const vectorService = require('../services/vectorService');

const router = express.Router();

/**
 * POST /api/vectors/search
 * Search documents using vector similarity
 */
router.post('/search', async (req, res) => {
  try {
    const { query, topK = 10, scoreThreshold = 0.7 } = req.body;
    const userId = req.user.uid;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        error: 'Query is required and must be a non-empty string'
      });
    }

    const results = await vectorService.searchDocuments(userId, query, topK);
    
    // Filter by score threshold
    const filteredResults = results.filter(result => result.score >= scoreThreshold);

    res.json({
      query: query,
      results: filteredResults,
      totalFound: results.length,
      filtered: filteredResults.length
    });

  } catch (error) {
    console.error('Vector search error:', error);
    res.status(500).json({
      error: 'Failed to search documents',
      message: error.message
    });
  }
});

/**
 * GET /api/vectors/stats
 * Get vector database statistics for user
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.uid;
    const stats = await vectorService.getDocumentStats(userId);

    res.json({
      userId: userId,
      ...stats
    });

  } catch (error) {
    console.error('Get vector stats error:', error);
    res.status(500).json({
      error: 'Failed to get vector statistics',
      message: error.message
    });
  }
});

/**
 * DELETE /api/vectors/document/:docId
 * Delete all vectors for a specific document
 */
router.delete('/document/:docId', async (req, res) => {
  try {
    const { docId } = req.params;
    const userId = req.user.uid;

    const result = await vectorService.deleteDocument(docId, userId);

    res.json({
      documentId: docId,
      deletedVectors: result.deletedCount,
      message: 'Document vectors deleted successfully'
    });

  } catch (error) {
    console.error('Delete vectors error:', error);
    res.status(500).json({
      error: 'Failed to delete document vectors',
      message: error.message
    });
  }
});

module.exports = router;
