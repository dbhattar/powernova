import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { getAuth } from 'firebase/auth';
import { webSocketService } from '../services/webSocketService';

const DocumentUpload = ({ onUpload, isUploading: externalUploading }) => {
  const [uploading, setUploading] = useState(false);

  const isUploading = externalUploading || uploading;

  useEffect(() => {
    // Connect to WebSocket when component mounts
    connectWebSocket();

    return () => {
      // Clean up WebSocket listeners
      webSocketService.off('document_processed', handleDocumentProcessed);
      webSocketService.off('job_progress', handleJobProgress);
    };
  }, []);

  const connectWebSocket = async () => {
    try {
      await webSocketService.connect();
      
      // Listen for document processing updates
      webSocketService.on('document_processed', handleDocumentProcessed);
      webSocketService.on('job_progress', handleJobProgress);
      
      console.log('✅ WebSocket listeners registered');
    } catch (error) {
      console.error('❌ Failed to connect WebSocket:', error);
    }
  };

  const handleDocumentProcessed = (data) => {
    console.log('📄 Document processed:', data);
    
    // Show notification
    if (data.status === 'completed') {
      Alert.alert('Success', `Document "${data.fileName}" processed successfully!`);
    } else if (data.status === 'failed') {
      Alert.alert('Error', `Failed to process "${data.fileName}": ${data.error}`);
    }
  };

  const handleJobProgress = (data) => {
    console.log('🔄 Job progress:', data);
  };

  const handleDocumentPick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      
      // If onUpload prop is provided, use it (legacy support)
      if (onUpload) {
        if (Platform.OS === 'web' && file.file) {
          onUpload({
            ...file,
            type: file.mimeType || file.type
          });
        } else {
          onUpload(file);
        }
        return;
      }

      // Otherwise, handle upload internally
      await uploadDocument(file);
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const uploadDocument = async (file) => {
    try {
      setUploading(true);

      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        Alert.alert('Error', 'Please log in to upload documents');
        return;
      }

      const token = await user.getIdToken();
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:9000';

      // Create form data
      const formData = new FormData();
      formData.append('document', {
        uri: file.uri,
        type: file.mimeType,
        name: file.name,
      });

      console.log('� Uploading document:', file.name);

      const response = await fetch(`${apiUrl}/api/documents/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        
        Alert.alert('Success', 'Document uploaded and queued for processing!');
        
        // Notify parent component about the upload
        if (onUpload) {
          onUpload(result);
        }
      } else {
        const error = await response.json();
        Alert.alert('Upload Failed', error.message || 'Failed to upload document');
      }
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.uploadButton, isUploading && styles.uploadButtonDisabled]}
        onPress={handleDocumentPick}
        disabled={isUploading}
      >
        <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
        <Text style={styles.uploadButtonText}>
          {isUploading ? 'Uploading...' : 'Upload Document'}
        </Text>
        {isUploading && <ActivityIndicator style={styles.spinner} color="#fff" />}
      </TouchableOpacity>
      
      <Text style={styles.supportedFormats}>
        Supported formats: PDF, DOC, DOCX, TXT
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  uploadButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    gap: 8,
    marginBottom: 8,
  },
  uploadButtonDisabled: {
    backgroundColor: '#ccc',
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  spinner: {
    marginLeft: 8,
  },
  supportedFormats: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default DocumentUpload;
