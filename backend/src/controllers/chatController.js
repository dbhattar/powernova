const express = require('express');
const multer = require('multer');
const openaiService = require('../services/openaiService');
const vectorService = require('../services/vectorService');
const firebaseService = require('../services/firebaseService');

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
    let documentContext = '';
    let searchResults = [];
    try {
      searchResults = await vectorService.searchDocuments(userId, message, 5);
      if (searchResults.length > 0) {
        documentContext = searchResults
          .filter(result => result.score > 0.7) // Relevance threshold
          .map(result => `Source: ${result.metadata.fileName}\n${result.metadata.text}`)
          .join('\n\n');
        
        if (documentContext) {
          console.log(`📚 Using document context from ${searchResults.length} sources`);
        }
      }
    } catch (vectorError) {
      console.log('⚠️  Vector search failed, continuing without document context:', vectorError.message);
    }

    // Log context status
    if (!documentContext) {
      console.log('💭 No document context available, using general knowledge only');
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

    // Save conversation to Firestore
    const conversationData = {
      uid: userId,
      threadId: currentThreadId,
      prompt: message,
      response: response,
      type: 'text',
      isFollowUp: isFollowUp,
      documentSources: searchResults?.map(r => r.metadata.docId) || [],
      createdAt: new Date()
    };

    await firebaseService.saveConversation(conversationData);

    res.json({
      response: response,
      threadId: currentThreadId,
      documentSources: conversationData.documentSources
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
    const transcription = await openaiService.transcribeAudio(req.file.buffer);

    if (!autoSend) {
      return res.json({
        transcription: transcription
      });
    }

    // Auto-send transcription to chat
    const searchResults = await vectorService.searchDocuments(userId, transcription, 5);
    const documentContext = searchResults
      .filter(result => result.score > 0.7)
      .map(result => `Source: ${result.metadata.fileName}\n${result.metadata.text}`)
      .join('\n\n');

    const enhancedPrompt = openaiService.buildEnhancedPrompt(transcription, documentContext);
    const response = await openaiService.generateChatCompletion([
      { role: 'user', content: enhancedPrompt }
    ]);

    const currentThreadId = threadId || `thread_${Date.now()}_${userId}`;

    // Save conversation
    const conversationData = {
      uid: userId,
      threadId: currentThreadId,
      prompt: transcription,
      response: response,
      type: 'voice',
      isFollowUp: false,
      documentSources: searchResults?.map(r => r.metadata.docId) || [],
      createdAt: new Date()
    };

    await firebaseService.saveConversation(conversationData);

    res.json({
      transcription: transcription,
      response: response,
      threadId: currentThreadId,
      documentSources: conversationData.documentSources
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

module.exports = router;
