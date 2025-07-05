const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const vectorService = require('../services/vectorService');
const firebaseService = require('../services/firebaseService');

const router = express.Router();

// Configure multer for document uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, DOCX, and TXT files are allowed'), false);
    }
  },
});

/**
 * POST /api/documents/upload
 * Upload and process a document
 */
router.post('/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Document file is required'
      });
    }

    const userId = req.user.uid;
    const file = req.file;
    
    // Extract text content based on file type
    let textContent = '';
    try {
      textContent = await extractTextContent(file);
    } catch (extractError) {
      return res.status(400).json({
        error: 'Failed to extract text from document',
        message: extractError.message
      });
    }

    if (!textContent || textContent.trim().length < 50) {
      return res.status(400).json({
        error: 'Document appears to be empty or too short for processing'
      });
    }

    // Save document metadata to Firestore
    const docId = await firebaseService.saveDocumentMetadata({
      userId: userId,
      fileName: file.originalname,
      fileSize: file.size,
      fileType: file.mimetype,
      processingStatus: 'processing',
      isProcessed: false
    });

    // Process document asynchronously
    processDocumentAsync(docId, userId, file.originalname, textContent);

    res.json({
      documentId: docId,
      fileName: file.originalname,
      fileSize: file.size,
      status: 'processing',
      message: 'Document uploaded successfully and is being processed'
    });

  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({
      error: 'Failed to upload document',
      message: error.message
    });
  }
});

/**
 * GET /api/documents
 * Get user's documents
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.uid;
    const documents = await firebaseService.getUserDocuments(userId);

    res.json({
      documents: documents
    });

  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({
      error: 'Failed to get documents',
      message: error.message
    });
  }
});

/**
 * GET /api/documents/:id
 * Get specific document
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;
    
    const document = await firebaseService.getDocument(id);
    
    // Check if user owns this document
    if (document.userId !== userId) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    res.json({
      document: document
    });

  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({
      error: 'Failed to get document',
      message: error.message
    });
  }
});

/**
 * DELETE /api/documents/:id
 * Delete a document
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;
    
    // Get document to verify ownership
    const document = await firebaseService.getDocument(id);
    
    if (document.userId !== userId) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    // Delete from vector store
    await vectorService.deleteDocument(id, userId);
    
    // Delete metadata from Firestore
    await firebaseService.deleteDocument(id);

    res.json({
      message: 'Document deleted successfully'
    });

  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({
      error: 'Failed to delete document',
      message: error.message
    });
  }
});

/**
 * GET /api/documents/:id/status
 * Get document processing status
 */
router.get('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;
    
    const document = await firebaseService.getDocument(id);
    
    if (document.userId !== userId) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    res.json({
      documentId: id,
      status: document.processingStatus,
      isProcessed: document.isProcessed,
      chunkCount: document.chunkCount || 0,
      processingError: document.processingError || null
    });

  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({
      error: 'Failed to get document status',
      message: error.message
    });
  }
});

/**
 * Extract text content from different file types
 */
async function extractTextContent(file) {
  const { buffer, mimetype } = file;

  switch (mimetype) {
    case 'application/pdf':
      const pdfData = await pdfParse(buffer);
      return pdfData.text;

    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      const docxResult = await mammoth.extractRawText({ buffer });
      return docxResult.value;

    case 'application/msword':
      // For older .doc files, you might need a different library
      // For now, throw an error suggesting conversion to .docx
      throw new Error('Please convert .doc files to .docx format for processing');

    case 'text/plain':
      return buffer.toString('utf-8');

    default:
      throw new Error(`Unsupported file type: ${mimetype}`);
  }
}

/**
 * Process document asynchronously
 */
async function processDocumentAsync(docId, userId, fileName, textContent) {
  try {
    console.log(`Processing document ${docId} for user ${userId}`);

    // Process with vector service
    const result = await vectorService.processDocument(docId, userId, fileName, textContent);

    // Update document status
    await firebaseService.updateDocumentStatus(docId, {
      processingStatus: 'completed',
      isProcessed: true,
      chunkCount: result.chunkCount
    });

    console.log(`Document ${docId} processed successfully`);

  } catch (error) {
    console.error(`Error processing document ${docId}:`, error);

    // Update with error status
    await firebaseService.updateDocumentStatus(docId, {
      processingStatus: 'error',
      isProcessed: false,
      processingError: error.message
    });
  }
}

module.exports = router;
