const admin = require('firebase-admin');

class FirebaseService {
  constructor() {
    this.db = admin.firestore();
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
  async updateDocumentStatus(docId, updates) {
    try {
      await this.db.collection('documents').doc(docId).update({
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
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
      const snapshot = await this.db
        .collection('documents')
        .where('userId', '==', userId)
        .orderBy('uploadedAt', 'desc')
        .get();

      const documents = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        documents.push({
          id: doc.id,
          ...data,
          uploadedAt: data.uploadedAt?.toDate() || new Date()
        });
      });

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
      await this.db.collection('documents').doc(docId).delete();
    } catch (error) {
      console.error('Error deleting document:', error);
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
}

module.exports = new FirebaseService();
