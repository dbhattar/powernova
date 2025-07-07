import { Linking, Platform, Alert } from 'react-native';
import { API_BASE_URL } from '../config/constants';
import { auth } from '../firebase';

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
      console.log('📄 Opening document:', documentId, 'page:', page);
      
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
        console.log('📄 Opening document directly');
        await this.openDocumentDirect(document.url);
      } else {
        throw new Error('Document URL not available');
      }
      
    } catch (error) {
      console.error('❌ Error opening document:', error);
      // Show error message to user
      Alert.alert('Error', `Unable to open document: ${error.message}`);
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
      
      if (WebBrowser) {
        await WebBrowser.openBrowserAsync(url, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
          controlsColor: '#007AFF',
        });
      } else {
        await Linking.openURL(url);
      }
      
    } catch (error) {
      console.error('Error opening PDF inline:', error);
      // Fallback to regular PDF opening
      await this.openPDF(pdfUrl, page);
    }
  }

  /**
   * Open document directly with appropriate viewer
   */
  static async openDocumentDirect(documentUrl) {
    try {
      if (WebBrowser) {
        await WebBrowser.openBrowserAsync(documentUrl, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
          controlsColor: '#007AFF',
        });
      } else {
        await Linking.openURL(documentUrl);
      }
    } catch (error) {
      console.error('Error opening document directly:', error);
      throw error;
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
   */
  static async getAuthToken() {
    if (!auth.currentUser) {
      throw new Error('User not authenticated');
    }
    return await auth.currentUser.getIdToken();
  }
}

export default DocumentViewerService;
