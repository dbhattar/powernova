const jobQueue = require('./jobQueue');
const vectorService = require('./vectorService');
const notificationService = require('./notificationService');
const firebaseService = require('./firebaseService');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

class VectorizationWorker {
  constructor() {
    this.isRunning = false;
    this.processingJob = null;
  }

  async start() {
    this.isRunning = true;
    console.log('🔄 Vectorization worker started');

    while (this.isRunning) {
      try {
        const job = await jobQueue.dequeue();
        if (job) {
          this.processingJob = job;
          await this.processJob(job);
          this.processingJob = null;
        }
        // Small delay to prevent tight loop
        await this.sleep(100);
      } catch (error) {
        console.error('❌ Worker error:', error);
        this.processingJob = null;
        // Wait before retrying on error
        await this.sleep(5000);
      }
    }

    console.log('🛑 Vectorization worker stopped');
  }

  async stop() {
    this.isRunning = false;
    console.log('🛑 Stopping vectorization worker...');
  }

  async processJob(job) {
    console.log(`🔄 Processing job ${job.id} of type ${job.type}`);

    try {
      await jobQueue.updateJobStatus(job.id, 'processing');

      if (job.type === 'vectorize_document') {
        await this._processDocumentVectorization(job);
      } else {
        throw new Error(`Unknown job type: ${job.type}`);
      }

      await jobQueue.updateJobStatus(job.id, 'completed');
      console.log(`✅ Job ${job.id} completed successfully`);

    } catch (error) {
      const errorMsg = error.message;
      console.error(`❌ Job ${job.id} failed:`, errorMsg);
      await jobQueue.updateJobStatus(job.id, 'failed', errorMsg);
    }
  }

  async _processDocumentVectorization(job) {
    const { documentId, fileBuffer, filename, mimeType, userId } = job.payload;

    try {
      // Notify user that processing started
      await notificationService.notifyJobProgress(
        userId,
        job.id,
        'processing',
        null,
        'Starting document vectorization...'
      );

      // Get document from Firestore
      const document = await firebaseService.getDocument(documentId);

      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }

      // Extract content from file buffer (since we don't store content in Firestore due to size limits)
      const fileBufferData = Buffer.from(fileBuffer);
      const textContent = await this._extractTextContent(fileBufferData, mimeType, filename);

      if (!textContent || textContent.trim().length === 0) {
        throw new Error(`Failed to extract content from document ${documentId}`);
      }

      console.log(`📄 Document content preview: ${textContent.substring(0, 100)}...`);
      console.log(`📊 Content length: ${textContent.length} characters`);

      // Process the document with vectorization using extracted content
      const result = await vectorService.processDocument(
        documentId,
        userId,
        filename,
        textContent
      );

      // Check if processing was successful
      if (!result.success) {
        throw new Error(result.message || 'Document processing failed');
      }

      // Update document status in Firestore
      await firebaseService.updateDocumentComplete(documentId, {
        vectorCount: result.vectorCount || result.chunkCount || 0
      });

      // Notify user of successful completion
      const updatedDocument = { 
        id: documentId, 
        fileName: filename, 
        userId: userId,
        processedAt: new Date().toISOString()
      };
      
      await notificationService.notifyDocumentProcessed(
        updatedDocument,
        'completed'
      );

    } catch (error) {
      // Update document status to failed in Firestore
      await firebaseService.updateDocumentError(documentId, error.message);

      // Notify user of failure
      const failedDocument = { 
        id: documentId, 
        fileName: filename, 
        userId: userId 
      };
      
      await notificationService.notifyDocumentProcessed(
        failedDocument,
        'failed',
        error.message
      );

      throw error;
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Extract text content from file buffer based on mime type
   */
  async _extractTextContent(buffer, mimeType, filename) {
    try {
      switch (mimeType) {
        case 'application/pdf':
          const pdfData = await pdfParse(buffer);
          return pdfData.text;

        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          const docxResult = await mammoth.extractRawText({ buffer });
          return docxResult.value;

        case 'application/msword':
          throw new Error('Please convert .doc files to .docx format for processing');

        case 'text/plain':
          return buffer.toString('utf-8');

        default:
          throw new Error(`Unsupported file type: ${mimeType}`);
      }
    } catch (error) {
      throw new Error(`Failed to extract text from ${filename}: ${error.message}`);
    }
  }

  getCurrentJob() {
    return this.processingJob;
  }
}

module.exports = new VectorizationWorker();
