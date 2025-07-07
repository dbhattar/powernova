import { Linking, Platform, Alert } from 'react-native';
import { API_BASE_URL } from '../config/constants';

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
      const token = await this.getAuthToken();
      const url = `${API_BASE_URL}/api/chat/document/${documentId}${page ? `?page=${page}` : ''}`;
      
      // Get document details first
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch document');
      }
      
      const document = await response.json();
      
      // Simple URL opening
      if (document.url) {
        await this.openURL(document.url, page);
      } else {
        Alert.alert('Document not available', 'The document could not be opened.');
      }
      
    } catch (error) {
      console.error('Error opening document:', error);
      Alert.alert('Error', 'Unable to open document. Please try again.');
    }
  }

  /**
   * Open URL with system browser
   */
  static async openURL(url, page = null) {
    try {
      let finalUrl = url;
      
      // Add page parameter for PDFs
      if (page) {
        finalUrl += `#page=${page}`;
      }
      
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
   * Get authentication token (placeholder)
   */
  static async getAuthToken() {
    // TODO: Implement your authentication logic here
    // For now, return a placeholder
    return 'your-auth-token';
  }
}

export default SimpleDocumentViewerService;
