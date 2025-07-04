import { storage, db } from './firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { collection, addDoc, deleteDoc, doc, query, where, orderBy, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';

// Document upload service
export class DocumentService {
  constructor(userId) {
    this.userId = userId;
    this.documentsRef = collection(db, 'documents');
  }

  // Upload document to Firebase Storage and save metadata to Firestore
  async uploadDocument(file, onProgress = null) {
    if (!this.userId) {
      throw new Error('User must be authenticated to upload documents');
    }

    console.log('Starting document upload for user:', this.userId);
    console.log('File details:', {
      name: file.name,
      size: file.size,
      type: file.type
    });

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];

    if (!allowedTypes.includes(file.type)) {
      throw new Error('Unsupported file type. Please upload PDF, DOC, DOCX, or TXT files.');
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new Error('File size must be less than 10MB');
    }

    try {
      // Create a unique filename
      const timestamp = Date.now();
      const fileExtension = file.name.split('.').pop();
      const fileName = `${timestamp}_${file.name}`;
      const filePath = `documents/${this.userId}/${fileName}`;

      console.log('Upload path:', filePath);

      // Upload file to Firebase Storage
      const storageRef = ref(storage, filePath);
      
      console.log('Starting upload to Firebase Storage...');
      const uploadTask = uploadBytes(storageRef, file);
      
      // Wait for upload to complete
      const snapshot = await uploadTask;
      console.log('Upload completed, getting download URL...');
      
      // Get download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      console.log('Download URL obtained:', downloadURL);

      // Save document metadata to Firestore
      const docData = {
        uid: this.userId,
        fileName: file.name,
        originalName: file.name,
        fileSize: file.size,
        fileType: file.type,
        filePath: filePath,
        downloadURL: downloadURL,
        uploadedAt: serverTimestamp(),
        isProcessed: false,
        extractedText: null,
        processingError: null
      };

      console.log('Saving metadata to Firestore...');
      const docRef = await addDoc(this.documentsRef, docData);
      console.log('Metadata saved with ID:', docRef.id);

      // Start text extraction in the background
      this.extractTextFromDocument(docRef.id, downloadURL, file.type);

      return {
        id: docRef.id,
        ...docData,
        uploadedAt: new Date()
      };

    } catch (error) {
      console.error('Document upload error details:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      if (error.code === 'storage/unauthorized') {
        throw new Error('Upload failed: Firebase Storage permission denied. Please check your storage security rules.');
      } else if (error.code === 'storage/canceled') {
        throw new Error('Upload was canceled.');
      } else if (error.code === 'storage/unknown') {
        throw new Error('Upload failed due to an unknown error. Please try again.');
      } else {
        throw new Error(`Upload failed: ${error.message}`);
      }
    }
  }

  // Extract text from document (simplified version)
  async extractTextFromDocument(documentId, downloadURL, fileType) {
    try {
      console.log('Starting text extraction for document:', documentId);
      
      // For now, we'll simulate text extraction
      // In a real implementation, you'd use a service like:
      // - PDF.js for PDFs
      // - A cloud service like Google Document AI
      // - OCR services for scanned documents
      
      let extractedText = '';
      
      if (fileType === 'text/plain') {
        // For text files, we can fetch and read directly
        const response = await fetch(downloadURL);
        extractedText = await response.text();
      } else {
        // For PDF/DOC files, you'd need a specialized library
        // For now, we'll store a placeholder
        extractedText = `[Text extraction from ${fileType} files requires additional setup. Document uploaded successfully but text extraction is not yet implemented.]`;
      }

      // Update document with extracted text
      await this.updateDocumentText(documentId, extractedText);
      
    } catch (error) {
      console.error('Text extraction error:', error);
      await this.updateDocumentError(documentId, error.message);
    }
  }

  // Update document with extracted text
  async updateDocumentText(documentId, extractedText) {
    try {
      const docRef = doc(db, 'documents', documentId);
      await updateDoc(docRef, {
        extractedText: extractedText,
        isProcessed: true,
        processingError: null
      });
    } catch (error) {
      console.error('Error updating document text:', error);
    }
  }

  // Update document with processing error
  async updateDocumentError(documentId, errorMessage) {
    try {
      const docRef = doc(db, 'documents', documentId);
      await updateDoc(docRef, {
        isProcessed: false,
        processingError: errorMessage
      });
    } catch (error) {
      console.error('Error updating document error:', error);
    }
  }

  // Get user's documents with real-time updates
  subscribeToDocuments(callback) {
    if (!this.userId) {
      console.log('No userId provided for document subscription');
      callback([]);
      return () => {};
    }

    console.log('Setting up document subscription for user:', this.userId);

    try {
      // Try simple query first (without orderBy to avoid index issues)
      const q = query(
        this.documentsRef,
        where('uid', '==', this.userId)
      );

      return onSnapshot(q, (querySnapshot) => {
        console.log('Document snapshot received, size:', querySnapshot.size);
        const documents = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          console.log('Document data:', { id: doc.id, fileName: data.fileName, uploadedAt: data.uploadedAt });
          documents.push({
            id: doc.id,
            ...data,
            uploadedAt: data.uploadedAt?.toDate() || new Date()
          });
        });
        
        // Sort documents by upload date manually (descending)
        documents.sort((a, b) => b.uploadedAt - a.uploadedAt);
        
        console.log('Processed documents:', documents.length);
        callback(documents);
      }, (error) => {
        console.error('Error fetching documents:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        if (error.code === 'failed-precondition') {
          console.error('This might be a missing Firestore index. Check the Firebase console for index requirements.');
          console.error('Try creating a composite index for: collection: documents, fields: uid (Ascending), uploadedAt (Descending)');
        } else if (error.code === 'permission-denied') {
          console.error('Permission denied. Check your Firestore security rules.');
        }
        
        callback([]);
      });
    } catch (error) {
      console.error('Error setting up document subscription:', error);
      callback([]);
      return () => {};
    }
  }

  // Delete document
  async deleteDocument(documentId, filePath) {
    try {
      // Delete from Firebase Storage
      const storageRef = ref(storage, filePath);
      await deleteObject(storageRef);

      // Delete from Firestore
      const docRef = doc(db, 'documents', documentId);
      await deleteDoc(docRef);

      console.log('Document deleted successfully');
    } catch (error) {
      console.error('Error deleting document:', error);
      throw new Error(`Delete failed: ${error.message}`);
    }
  }

  // Search documents by content
  searchDocuments(searchTerm, documents) {
    if (!searchTerm.trim()) {
      return documents;
    }

    const term = searchTerm.toLowerCase();
    return documents.filter(doc => 
      doc.fileName.toLowerCase().includes(term) ||
      doc.originalName.toLowerCase().includes(term) ||
      (doc.extractedText && doc.extractedText.toLowerCase().includes(term))
    );
  }

  // Get document content for AI queries
  getDocumentContext(documents, searchTerm = '') {
    const relevantDocs = searchTerm ? this.searchDocuments(searchTerm, documents) : documents;
    
    return relevantDocs
      .filter(doc => doc.isProcessed && doc.extractedText)
      .map(doc => ({
        fileName: doc.fileName,
        content: doc.extractedText.substring(0, 4000) // Limit content length
      }));
  }
}

// Utility functions
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const getFileIcon = (fileType) => {
  if (fileType.includes('pdf')) return 'document-text';
  if (fileType.includes('word') || fileType.includes('doc')) return 'document';
  if (fileType.includes('text')) return 'document-outline';
  return 'document';
};
