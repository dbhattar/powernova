import { Linking, Platform, Alert } from 'react-native';
import { API_BASE_URL } from '../config/constants';
import { auth } from '../firebase';

/**
 * Simplified Document Viewer Service
 * Falls back to basic functionality if Expo packages are not available
 */
class SimpleDocumentViewerService {
  /**
   * Handle document reference click
   */
  static async handleDocumentPress(documentId, page = null) {
    try {
      console.log('📄 Opening document (Simple):', documentId, 'page:', page);
      
      const token = await this.getAuthToken();
      const url = `${API_BASE_URL}/api/chat/document/${documentId}${page ? `?page=${page}` : ''}`;
      
      console.log('🔗 Fetching document from:', url);
      
      // Get document details first
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error:', response.status, errorText);
        throw new Error(`Failed to fetch document: ${response.status} ${errorText}`);
      }
      
      const document = await response.json();
      console.log('📋 Document details:', document);
      
      // For PDFs, try to modify the URL to force inline viewing
      if (document.type === 'pdf' && document.url) {
        console.log('📄 Opening PDF with inline viewer');
        await this.openPDFInline(document.url, page);
      } else if (document.url) {
        console.log('🔗 Opening document URL');
        await this.openURL(document.url, page);
      } else {
        Alert.alert('Document not available', 'The document could not be opened.');
      }
      
    } catch (error) {
      console.error('❌ Error opening document:', error);
      Alert.alert('Error', `Unable to open document: ${error.message}`);
    }
  }

  /**
   * Open URL with system browser
   */
  static async openURL(url, page = null) {
    try {
      let finalUrl = url;
      
      // Add page parameter for PDFs (if not already added)
      if (page && !finalUrl.includes('#page=')) {
        finalUrl += `#page=${page}`;
      }
      
      console.log('🌐 Opening URL:', finalUrl);
      
      const canOpen = await Linking.canOpenURL(finalUrl);
      if (canOpen) {
        await Linking.openURL(finalUrl);
      } else {
        Alert.alert('Error', 'Cannot open this document type.');
      }
    } catch (error) {
      console.error('Error opening URL:', error);
      Alert.alert('Error', 'Failed to open document.');
    }
  }

  /**
   * Open PDF with inline viewing (try to prevent download)
   */
  static async openPDFInline(pdfUrl, page = null) {
    try {
      // Try to modify Firebase Storage URL to force inline viewing
      let url = pdfUrl;
      
      // If it's a Firebase Storage URL, try to modify it for inline viewing
      if (url.includes('firebasestorage.googleapis.com')) {
        // Remove any existing response-content-disposition parameter
        url = url.replace(/[?&]response-content-disposition=[^&]*/, '');
        
        // Add inline disposition
        const separator = url.includes('?') ? '&' : '?';
        url += `${separator}response-content-disposition=inline`;
      }
      
      // Add page parameter if specified
      if (page) {
        url += `#page=${page}`;
      }
      
      console.log('🌐 Opening PDF URL:', url);
      await this.openURL(url);
      
    } catch (error) {
      console.error('Error opening PDF inline:', error);
      // Fallback to regular URL opening
      await this.openURL(pdfUrl, page);
    }
  }

  /**
   * Get authentication token
   */
  static async getAuthToken() {
    if (!auth.currentUser) {
      throw new Error('User not authenticated');
    }
    return await auth.currentUser.getIdToken();
  }
}

export default SimpleDocumentViewerService;
