const express = require('express');
const multer = require('multer');
const openaiService = require('../services/openaiService');
const vectorService = require('../services/vectorService');
const firebaseService = require('../services/firebaseService');
const DocumentReferenceService = require('../services/documentReferenceService');

const router = express.Router();

// Configure multer for audio file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit for audio files
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'), false);
    }
  },
});

/**
 * POST /api/chat/message
 * Send a chat message with optional document context
 */
router.post('/message', async (req, res) => {
  try {
    const { message, threadId, isFollowUp = false } = req.body;
    const userId = req.user.uid;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        error: 'Message is required and must be a non-empty string'
      });
    }

    // Get conversation history for follow-ups
    let conversationHistory = [];
    if (isFollowUp && threadId) {
      conversationHistory = await firebaseService.getConversationThread(userId, threadId);
    }

    // Perform semantic search on user's documents
    let searchResults = [];
    try {
      console.log(`🔍 Starting document search for user: ${userId}, query: "${message}"`);
      searchResults = await vectorService.searchDocuments(userId, message, 5);
      console.log(`📊 Search completed. Found ${searchResults.length} results`);
      
      if (searchResults.length > 0) {
        console.log(`📋 Search result details:`);
        searchResults.forEach((result, index) => {
          console.log(`   ${index + 1}. Score: ${result.score?.toFixed(4)}, File: ${result.metadata?.fileName}, Content preview: "${result.metadata?.text?.substring(0, 100)}..."`);
        });
      } else {
        console.log(`❌ No search results returned from vector service`);
      }
    } catch (vectorError) {
      console.log('⚠️  Vector search failed, continuing without document context:', vectorError.message);
    }

    // Process search results and extract document references
    const { documentContext, sourceDocuments, hasReferences } = DocumentReferenceService.processSearchResults(searchResults);

    // Log context status
    if (!documentContext) {
      console.log('💭 No document context available, using general knowledge only');
    } else {
      console.log(`📚 Using document context from ${sourceDocuments.length} sources (${documentContext.length} characters)`);
    }

    // Build enhanced prompt
    const enhancedPrompt = openaiService.buildEnhancedPrompt(
      message,
      documentContext,
      conversationHistory
    );

    // Generate response from OpenAI
    const response = await openaiService.generateChatCompletion([
      { role: 'user', content: enhancedPrompt }
    ]);

    // Generate thread ID if not provided
    const currentThreadId = threadId || `thread_${Date.now()}_${userId}`;

    // Add document references to response
    let responseWithReferences = response;
    if (hasReferences) {
      const documentReferences = DocumentReferenceService.formatDocumentReferences(sourceDocuments);
      responseWithReferences += documentReferences;
    }

    // Generate reference summary for metadata
    const referenceSummary = DocumentReferenceService.generateReferenceSummary(sourceDocuments);

    // Save conversation to Firestore
    const conversationData = {
      uid: userId,
      threadId: currentThreadId,
      prompt: message,
      response: responseWithReferences,
      type: 'text',
      isFollowUp: isFollowUp,
      documentSources: sourceDocuments.map(doc => doc.id),
      sourceDocuments: sourceDocuments,
      referenceSummary: referenceSummary,
      createdAt: new Date()
    };

    await firebaseService.saveConversation(conversationData);

    res.json({
      response: responseWithReferences,
      threadId: currentThreadId,
      documentSources: sourceDocuments,
      hasReferences: hasReferences,
      referenceSummary: referenceSummary
    });

  } catch (error) {
    console.error('Chat message error:', error);
    res.status(500).json({
      error: 'Failed to process chat message',
      message: error.message
    });
  }
});

/**
 * POST /api/chat/transcribe
 * Transcribe audio and optionally send to chat
 */
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Audio file is required'
      });
    }

    const { autoSend = false, threadId } = req.body;
    const userId = req.user.uid;

    // Transcribe audio
    const transcription = await openaiService.transcribeAudio(req.file);

    if (!autoSend) {
      return res.json({
        transcription: transcription
      });
    }

    // Auto-send transcription to chat
    const searchResults = await vectorService.searchDocuments(userId, transcription, 5);
    
    // Process search results and extract document references
    const { documentContext, sourceDocuments, hasReferences } = DocumentReferenceService.processSearchResults(searchResults);

    const enhancedPrompt = openaiService.buildEnhancedPrompt(transcription, documentContext);
    const response = await openaiService.generateChatCompletion([
      { role: 'user', content: enhancedPrompt }
    ]);

    const currentThreadId = threadId || `thread_${Date.now()}_${userId}`;

    // Add document references to response
    let responseWithReferences = response;
    if (hasReferences) {
      const documentReferences = DocumentReferenceService.formatDocumentReferences(sourceDocuments);
      responseWithReferences += documentReferences;
    }

    // Generate reference summary for metadata
    const referenceSummary = DocumentReferenceService.generateReferenceSummary(sourceDocuments);

    // Save conversation
    const conversationData = {
      uid: userId,
      threadId: currentThreadId,
      prompt: transcription,
      response: responseWithReferences,
      type: 'voice',
      isFollowUp: false,
      documentSources: sourceDocuments.map(doc => doc.id),
      sourceDocuments: sourceDocuments,
      referenceSummary: referenceSummary,
      createdAt: new Date()
    };

    await firebaseService.saveConversation(conversationData);

    res.json({
      transcription: transcription,
      response: responseWithReferences,
      threadId: currentThreadId,
      documentSources: sourceDocuments,
      hasReferences: hasReferences,
      referenceSummary: referenceSummary
    });

  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({
      error: 'Failed to transcribe audio',
      message: error.message
    });
  }
});

/**
 * GET /api/chat/history
 * Get conversation history for user
 */
router.get('/history', async (req, res) => {
  try {
    const userId = req.user.uid;
    const { limit = 50, offset = 0 } = req.query;

    const conversations = await firebaseService.getConversationHistory(
      userId,
      parseInt(limit),
      parseInt(offset)
    );

    res.json({
      conversations: conversations,
      total: conversations.length
    });

  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({
      error: 'Failed to get conversation history',
      message: error.message
    });
  }
});

/**
 * GET /api/chat/thread/:threadId
 * Get specific conversation thread
 */
router.get('/thread/:threadId', async (req, res) => {
  try {
    const userId = req.user.uid;
    const { threadId } = req.params;

    const thread = await firebaseService.getConversationThread(userId, threadId);

    res.json({
      thread: thread,
      threadId: threadId
    });

  } catch (error) {
    console.error('Get thread error:', error);
    res.status(500).json({
      error: 'Failed to get conversation thread',
      message: error.message
    });
  }
});

/**
 * GET /api/chat/document/:documentId
 * Get document details for chat references
 */
router.get('/document/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const { page } = req.query;
    const userId = req.user.uid;

    // Get document from Firestore
    const document = await firebaseService.getDocument(documentId);
    
    // Check if document belongs to the user
    if (document.uid !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Return document details with optional page highlighting
    const response = {
      id: document.id,
      name: document.fileName,
      type: document.type,
      uploadDate: document.createdAt,
      size: document.size,
      url: document.downloadUrl
    };

    // If page is specified and it's a PDF, include page reference
    if (page && document.type === 'pdf') {
      response.highlightPage = parseInt(page);
    }

    res.json(response);
  } catch (error) {
    console.error('Error serving document reference:', error);
    res.status(500).json({ error: 'Failed to retrieve document' });
  }
});

module.exports = router;
