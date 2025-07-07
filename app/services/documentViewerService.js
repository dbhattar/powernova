import { Linking, Platform, Alert } from 'react-native';
import { API_BASE_URL } from '../config/constants';

// Try to import Expo packages, but handle gracefully if not available
let FileSystem, WebBrowser;
try {
  FileSystem = require('expo-file-system');
  WebBrowser = require('expo-web-browser');
} catch (error) {
  console.warn('Expo packages not available, some features may be limited:', error.message);
}

class DocumentViewerService {
  /**
   * Handle document reference click
   */
  static async handleDocumentPress(documentId, page = null) {
    try {
      const token = await this.getAuthToken(); // Implement based on your auth system
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
      
      // Handle different document types
      if (document.type === 'pdf' && document.url) {
        await this.openPDF(document.url, page);
      } else if (document.downloadUrl) {
        await this.downloadAndOpen(document);
      } else {
        // Fallback: open in browser
        await WebBrowser.openBrowserAsync(url);
      }
      
    } catch (error) {
      console.error('Error opening document:', error);
      // Show error message to user
      Alert.alert('Error', 'Unable to open document. Please try again.');
    }
  }

  /**
   * Open PDF with optional page highlighting
   */
  static async openPDF(pdfUrl, page = null) {
    try {
      let url = pdfUrl;
      
      // Add page parameter if specified
      if (page) {
        url += `#page=${page}`;
      }
      
      if (Platform.OS === 'ios') {
        // On iOS, use WebBrowser for better PDF viewing experience if available
        if (WebBrowser) {
          await WebBrowser.openBrowserAsync(url, {
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
            controlsColor: '#007AFF',
          });
        } else {
          // Fallback to system browser
          await Linking.openURL(url);
        }
      } else {
        // On Android, try to open with system PDF viewer
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        } else if (WebBrowser) {
          await WebBrowser.openBrowserAsync(url);
        } else {
          throw new Error('Cannot open PDF - no suitable viewer available');
        }
      }
    } catch (error) {
      console.error('Error opening PDF:', error);
      throw error;
    }
  }

  /**
   * Download and open document
   */
  static async downloadAndOpen(document) {
    try {
      if (!FileSystem) {
        // Fallback to opening URL directly
        await Linking.openURL(document.downloadUrl);
        return;
      }

      const fileUri = FileSystem.documentDirectory + document.name;
      
      // Download the file
      const downloadResult = await FileSystem.downloadAsync(
        document.downloadUrl,
        fileUri
      );
      
      if (downloadResult.status === 200) {
        // Try to open with system apps
        await this.openWithSystemApps(downloadResult.uri);
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error('Error downloading document:', error);
      // Fallback to opening URL directly
      try {
        await Linking.openURL(document.downloadUrl);
      } catch (linkError) {
        throw new Error('Cannot open document - download and direct link failed');
      }
    }
  }

  /**
   * Open document with system apps
   */
  static async openWithSystemApps(fileUri) {
    try {
      if (Platform.OS === 'ios') {
        // On iOS, use document interaction
        await Linking.openURL(fileUri);
      } else {
        // On Android, use file intent
        await Linking.openURL(fileUri);
      }
    } catch (error) {
      console.error('Error opening with system apps:', error);
      // Fallback to WebBrowser if available
      if (WebBrowser) {
        await WebBrowser.openBrowserAsync(fileUri);
      } else {
        throw new Error('Cannot open document with system apps');
      }
    }
  }

  /**
   * Get authentication token
   * Replace this with your actual auth implementation
   */
  static async getAuthToken() {
    // Implement based on your authentication system
    // This is a placeholder
    return 'your-auth-token';
  }
}

export default DocumentViewerService;
