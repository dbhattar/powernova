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
    fileSize: 100 * 1024 * 1024, // 100MB limit (increased from 50MB)
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
    console.log('📤 Upload request received');
    console.log('📄 Request file:', req.file ? 'Present' : 'Missing');
    console.log('📄 Request body:', req.body);
    console.log('📄 Request headers:', req.headers);
    
    if (!req.file) {
      console.log('❌ No file in request');
      return res.status(400).json({
        error: 'Document file is required'
      });
    }

    console.log('📄 File details:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

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

    // Validate document for processing
    try {
      const validation = vectorService.validateDocumentForProcessing(textContent, file.originalname);
      console.log(`📋 Document validation passed:`, validation);
    } catch (validationError) {
      return res.status(400).json({
        error: 'Document validation failed',
        message: validationError.message
      });
    }

    // Calculate optimal chunk parameters
    const chunkParams = vectorService.calculateOptimalChunkSize(textContent);
    console.log(`⚙️ Using chunk parameters:`, chunkParams);

    // Upload file to Firebase Storage
    console.log('📤 Uploading file to Firebase Storage...');
    const uploadResult = await firebaseService.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      userId
    );

    // Save document metadata to Firestore with download URL
    const docId = await firebaseService.saveDocumentMetadata({
      userId: userId,
      fileName: file.originalname,
      fileSize: file.size,
      fileType: file.mimetype,
      filePath: uploadResult.filePath,
      downloadUrl: uploadResult.downloadUrl,
      type: file.mimetype,
      characterCount: textContent.length,
      estimatedTokens: Math.ceil(textContent.length / 4),
      processingStatus: 'processing',
      isProcessed: false
    });

    // Process document asynchronously with improved chunking
    processDocumentAsync(docId, userId, file.originalname, textContent, chunkParams);

    res.json({
      documentId: docId,
      fileName: file.originalname,
      fileSize: file.size,
      downloadUrl: uploadResult.downloadUrl,
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
    console.log('📋 GET /api/documents - User:', req.user?.uid);
    
    const userId = req.user.uid;
    const documents = await firebaseService.getUserDocuments(userId);

    console.log('📋 Returning documents:', documents.length);
    res.json({
      documents: documents
    });

  } catch (error) {
    console.error('❌ Get documents error:', error);
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
    
    console.log('📄 DOCUMENT CONTROLLER - Getting document:', id, 'for user:', userId);
    
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
  console.log('🔴 DELETE ROUTE HIT - ENTRY POINT');
  console.log('🔴 Request params:', req.params);
  console.log('🔴 Request headers:', req.headers);
  console.log('🔴 Request method:', req.method);
  console.log('🔴 Request URL:', req.url);
  
  try {
    const { id } = req.params;
    const userId = req.user.uid;
    
    console.log('🗑️  DELETE request - Document ID:', id, 'User:', userId);
    
    // Get document to verify ownership
    const document = await firebaseService.getDocument(id);
    console.log('📄 Document found:', document);
    
    // Check ownership using both possible field names
    const isOwner = document.userId === userId || document.uid === userId;
    
    if (!isOwner) {
      console.log('❌ Access denied - Document owner:', document.userId || document.uid, 'User:', userId);
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    console.log('✅ Document ownership verified');

    // Delete from vector store
    console.log('🗑️  Deleting from vector store...');
    await vectorService.deleteDocument(id, userId);
    console.log('✅ Vector store deletion completed');
    
    // Delete file from Firebase Storage if filePath exists
    if (document.filePath) {
      console.log('🗑️  Deleting from Firebase Storage...');
      await firebaseService.deleteFile(document.filePath);
      console.log('✅ Firebase Storage deletion completed');
    }
    
    // Delete metadata from Firestore
    console.log('🗑️  Deleting from Firestore...');
    await firebaseService.deleteDocument(id);
    console.log('✅ Firestore deletion completed');

    console.log('🎉 Document deleted successfully');
    res.json({
      message: 'Document deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete document error:', error);
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
 * Process document asynchronously with improved chunking and error handling
 */
async function processDocumentAsync(docId, userId, fileName, textContent, chunkParams) {
  try {
    console.log(`🔄 Starting async processing for document: ${fileName}`);
    console.log(`📊 Document stats: ${textContent.length} characters, ~${Math.ceil(textContent.length / 4)} tokens`);
    
    // Update processing status
    await firebaseService.updateDocumentStatus(docId, {
      processingStatus: 'processing',
      message: 'Creating embeddings and vector index...',
      progress: 0
    });

    // Process document with optimal chunking
    const result = await vectorService.processDocument(docId, userId, fileName, textContent, chunkParams);

    // Update completion status
    await firebaseService.updateDocumentStatus(docId, {
      processingStatus: 'completed',
      isProcessed: true,
      chunkCount: result.chunkCount,
      message: 'Document processed successfully',
      progress: 100
    });

    console.log(`✅ Document processing completed: ${fileName} (${result.chunkCount} chunks)`);

  } catch (error) {
    console.error(`❌ Error processing document ${docId}:`, error);

    // Update error status
    await firebaseService.updateDocumentStatus(docId, {
      processingStatus: 'error',
      isProcessed: false,
      processingError: error.message,
      message: `Processing failed: ${error.message}`,
      progress: 0
    });
  }
}

module.exports = router;
