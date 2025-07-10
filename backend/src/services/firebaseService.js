const admin = require('../config/firebase');

class FirebaseService {
  constructor() {
    this.db = admin.firestore();
    this.storage = admin.storage();
  }

  /**
   * Verify Firebase ID token
   */
  async verifyIdToken(idToken) {
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      return decodedToken;
    } catch (error) {
      console.error('❌ Failed to verify Firebase ID token:', error.message);
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Save conversation to Firestore
   */
  async saveConversation(conversationData) {
    try {
      const docRef = await this.db.collection('conversations').add({
        ...conversationData,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return docRef.id;
    } catch (error) {
      console.error('Error saving conversation:', error);
      throw new Error(`Failed to save conversation: ${error.message}`);
    }
  }

  /**
   * Get conversation history for user
   */
  async getConversationHistory(userId, limit = 50, offset = 0) {
    try {
      const snapshot = await this.db
        .collection('conversations')
        .where('uid', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .offset(offset)
        .get();

      const conversations = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        conversations.push({
          id: doc.id,
          ...data,
          timestamp: data.createdAt?.toDate() || new Date()
        });
      });

      return conversations;
    } catch (error) {
      console.error('Error getting conversation history:', error);
      throw new Error(`Failed to get conversation history: ${error.message}`);
    }
  }

  /**
   * Get conversation thread
   */
  async getConversationThread(userId, threadId) {
    try {
      const snapshot = await this.db
        .collection('conversations')
        .where('uid', '==', userId)
        .where('threadId', '==', threadId)
        .orderBy('createdAt', 'asc')
        .get();

      const thread = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        thread.push({
          id: doc.id,
          prompt: data.prompt,
          response: data.response,
          timestamp: data.createdAt?.toDate() || new Date()
        });
      });

      return thread;
    } catch (error) {
      console.error('Error getting conversation thread:', error);
      throw new Error(`Failed to get conversation thread: ${error.message}`);
    }
  }

  /**
   * Save document metadata to Firestore
   */
  async saveDocument(documentData) {
    try {
      const docRef = this.db.collection('documents').doc(documentData.documentId);
      await docRef.set({
        ...documentData,
        uploadedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`📝 Document saved to Firestore: ${documentData.documentId}`);
      return documentData.documentId;
    } catch (error) {
      console.error('Error saving document:', error);
      throw new Error(`Failed to save document: ${error.message}`);
    }
  }

  /**
   * Save document metadata to Firestore
   */
  async saveDocumentMetadata(documentData) {
    try {
      const docRef = await this.db.collection('documents').add({
        ...documentData,
        uploadedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return docRef.id;
    } catch (error) {
      console.error('Error saving document metadata:', error);
      throw new Error(`Failed to save document metadata: ${error.message}`);
    }
  }

  /**
   * Update document processing status
   */
  async updateDocumentStatus(docId, statusData) {
    try {
      const updateData = {
        ...statusData,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      };
      
      await this.db.collection('documents').doc(docId).update(updateData);
      console.log(`📝 Updated document ${docId} status:`, statusData.processingStatus || statusData.status || 'unknown');
      
    } catch (error) {
      console.error('Error updating document status:', error);
      throw new Error(`Failed to update document status: ${error.message}`);
    }
  }

  /**
   * Update document with processing completion data
   */
  async updateDocumentComplete(docId, completionData) {
    try {
      const updateData = {
        status: 'completed',
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        vectorCount: completionData.vectorCount || 0,
        ...completionData
      };
      
      await this.db.collection('documents').doc(docId).update(updateData);
      console.log(`📝 Document ${docId} marked as completed`);
      
    } catch (error) {
      console.error('Error updating document completion:', error);
      throw new Error(`Failed to update document completion: ${error.message}`);
    }
  }

  /**
   * Update document with error status
   */
  async updateDocumentError(docId, errorMessage) {
    try {
      const updateData = {
        status: 'failed',
        errorMessage: errorMessage,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      };
      
      await this.db.collection('documents').doc(docId).update(updateData);
      console.log(`📝 Document ${docId} marked as failed: ${errorMessage}`);
      
    } catch (error) {
      console.error('Error updating document error:', error);
      throw new Error(`Failed to update document error: ${error.message}`);
    }
  }

  /**
   * Update document processing status (legacy method)
   */
  async updateDocumentStatusLegacy(docId, statusData) {
    try {
      const updateData = {
        ...statusData,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      };
      
      await this.db.collection('documents').doc(docId).update(updateData);
      console.log(`📝 Updated document ${docId} status:`, statusData.processingStatus || 'unknown');
      
    } catch (error) {
      console.error('Error updating document status:', error);
      throw new Error(`Failed to update document status: ${error.message}`);
    }
  }

  /**
   * Get user's documents
   */
  async getUserDocuments(userId) {
    try {
      console.log('🔍 Getting documents for user:', userId);
      
      // Try both field names for backward compatibility
      // First try with 'userId' (current standard)
      let snapshot = await this.db
        .collection('documents')
        .where('userId', '==', userId)
        .get();

      console.log('📄 Found documents with userId field:', snapshot.size);

      // If no documents found with 'userId', try with 'uid' (legacy)
      if (snapshot.empty) {
        console.log('🔍 Trying legacy uid field...');
        snapshot = await this.db
          .collection('documents')
          .where('uid', '==', userId)
          .get();
        console.log('📄 Found documents with uid field:', snapshot.size);
      }

      const documents = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        documents.push({
          id: doc.id,
          ...data,
          uploadedAt: data.uploadedAt?.toDate() || new Date()
        });
      });

      console.log('📄 Total documents found:', documents.length);
      return documents;
    } catch (error) {
      console.error('Error getting user documents:', error);
      throw new Error(`Failed to get user documents: ${error.message}`);
    }
  }

  /**
   * Delete document metadata
   */
  async deleteDocument(docId) {
    try {
      console.log('🗑️  Deleting document from Firestore:', docId);
      await this.db.collection('documents').doc(docId).delete();
      console.log('✅ Document deleted from Firestore:', docId);
    } catch (error) {
      console.error('❌ Error deleting document from Firestore:', error);
      throw new Error(`Failed to delete document: ${error.message}`);
    }
  }

  /**
   * Get document by ID
   */
  async getDocument(docId) {
    try {
      const doc = await this.db.collection('documents').doc(docId).get();
      
      if (!doc.exists) {
        throw new Error('Document not found');
      }

      return {
        id: doc.id,
        ...doc.data()
      };
    } catch (error) {
      console.error('Error getting document:', error);
      throw new Error(`Failed to get document: ${error.message}`);
    }
  }

  /**
   * Upload file to Firebase Storage
   */
  async uploadFile(fileBuffer, fileName, fileType, userId) {
    try {
      // Create a unique file path
      const timestamp = Date.now();
      const fileExtension = fileName.split('.').pop();
      const uniqueFileName = `${timestamp}_${fileName}`;
      const filePath = `documents/${userId}/${uniqueFileName}`;
      
      console.log('📤 Uploading file to Firebase Storage:', filePath);
      
      // Get bucket reference
      const bucket = this.storage.bucket();
      const file = bucket.file(filePath);
      
      // Upload the file
      await file.save(fileBuffer, {
        metadata: {
          contentType: fileType,
          metadata: {
            originalName: fileName,
            uploadedBy: userId,
            uploadedAt: new Date().toISOString()
          }
        }
      });
      
      // Make the file publicly accessible
      await file.makePublic();
      
      // Get the download URL
      const downloadUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
      
      console.log('✅ File uploaded successfully:', downloadUrl);
      
      return {
        filePath,
        downloadUrl,
        fileName: uniqueFileName,
        originalName: fileName
      };
      
    } catch (error) {
      console.error('Error uploading file to Firebase Storage:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Delete file from Firebase Storage
   */
  async deleteFile(filePath) {
    try {
      console.log('🗑️ Deleting file from Firebase Storage:', filePath);
      
      const bucket = this.storage.bucket();
      const file = bucket.file(filePath);
      
      await file.delete();
      console.log('✅ File deleted successfully:', filePath);
      
    } catch (error) {
      console.error('Error deleting file from Firebase Storage:', error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Find document by file hash for duplicate detection
   */
  async findDocumentByHash(userId, fileHash) {
    try {
      console.log('🔍 Checking for duplicate file with hash:', fileHash);
      
      const snapshot = await this.db
        .collection('documents')
        .where('userId', '==', userId)
        .where('fileHash', '==', fileHash)
        .limit(1)
        .get();

      if (snapshot.empty) {
        console.log('📄 No duplicate found for hash:', fileHash);
        return null;
      }

      const doc = snapshot.docs[0];
      const data = doc.data();
      
      console.log('📄 Duplicate document found:', {
        id: doc.id,
        fileName: data.fileName,
        uploadedAt: data.uploadedAt
      });

      return {
        id: doc.id,
        ...data,
        uploadedAt: data.uploadedAt?.toDate() || new Date()
      };
    } catch (error) {
      console.error('Error checking for duplicate document:', error);
      throw new Error(`Failed to check for duplicate document: ${error.message}`);
    }
  }
}

module.exports = new FirebaseService();
