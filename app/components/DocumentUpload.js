import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Animated,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { getAuth } from 'firebase/auth';
import { webSocketService } from '../services/webSocketService';

const DocumentUpload = ({ onUpload, isUploading: externalUploading }) => {
  const [uploading, setUploading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackType, setFeedbackType] = useState(''); // 'success', 'error', 'duplicate'
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const isUploading = externalUploading || uploading;

  // Function to show feedback message with fade animation
  const showFeedback = (message, type = 'success') => {
    setFeedbackMessage(message);
    setFeedbackType(type);
    
    // Fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    
    // Fade out after 4 seconds
    setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        setFeedbackMessage('');
        setFeedbackType('');
      });
    }, 4000);
  };

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
      
      // Always handle upload internally to show feedback
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
      
      // Handle different platforms
      if (Platform.OS === 'web') {
        if (file.file) {
          formData.append('document', file.file, file.name);
        } else {
          // Try to create a blob from the URI
          const response = await fetch(file.uri);
          const blob = await response.blob();
          formData.append('document', blob, file.name);
        }
      } else {
        // For native platforms
        formData.append('document', {
          uri: file.uri,
          type: file.mimeType || file.type,
          name: file.name,
        });
      }

      console.log('📤 Uploading document:', file.name);
      console.log('📤 File details:', {
        name: file.name,
        mimeType: file.mimeType,
        type: file.type,
        size: file.size,
        uri: file.uri
      });

      const response = await fetch(`${apiUrl}/api/documents/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type - let the browser set it with boundary for multipart/form-data
        },
        body: formData,
      });

      console.log('📤 Response status:', response.status);
      console.log('📤 Response headers:', Object.fromEntries(response.headers.entries()));

      if (response.ok) {
        const result = await response.json();
        console.log('📤 Upload response:', JSON.stringify(result, null, 2));
        
        if (result.isDuplicate) {
          console.log('🔄 Duplicate file detected, showing feedback');
          // Handle duplicate file with clear, friendly message
          showFeedback(
            `Not uploaded - "${result.existingDocument.fileName}" already exists in your documents`,
            'duplicate'
          );
          
          // Notify parent component to refresh and potentially highlight the existing document
          if (onUpload) {
            onUpload({
              ...result.existingDocument,
              isExisting: true,
              isDuplicate: true
            });
          }
        } else {
          console.log('✅ New document uploaded successfully');
          // Handle new document upload
          showFeedback('Document uploaded and queued for processing!', 'success');
          
          // Notify parent component about the upload
          if (onUpload) {
            onUpload(result);
          }
        }
      } else {
        const error = await response.json();
        console.log('❌ Upload failed:', error);
        showFeedback(error.message || 'Failed to upload document', 'error');
      }
    } catch (error) {
      console.error('Upload error:', error);
      showFeedback('Failed to upload document', 'error');
    } finally {
      setUploading(false);
    }
  };

  const getFeedbackIcon = () => {
    switch (feedbackType) {
      case 'success':
        return 'checkmark-circle';
      case 'duplicate':
        return 'information-circle';
      case 'error':
        return 'alert-circle';
      default:
        return 'information-circle';
    }
  };

  const getFeedbackStyle = () => {
    switch (feedbackType) {
      case 'success':
        return styles.feedbackSuccess;
      case 'duplicate':
        return styles.feedbackDuplicate;
      case 'error':
        return styles.feedbackError;
      default:
        return styles.feedbackSuccess;
    }
  };

  const getFeedbackTextStyle = () => {
    switch (feedbackType) {
      case 'success':
        return styles.feedbackTextSuccess;
      case 'duplicate':
        return styles.feedbackTextDuplicate;
      case 'error':
        return styles.feedbackTextError;
      default:
        return styles.feedbackTextSuccess;
    }
  };

  return (
    <View style={styles.container}>
      {/* Animated Feedback Message */}
      {feedbackMessage ? (
        <Animated.View
          style={[
            styles.feedbackContainer,
            getFeedbackStyle(),
            {
              opacity: fadeAnim,
              transform: [
                {
                  translateY: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-10, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Ionicons
            name={getFeedbackIcon()}
            size={20}
            color={StyleSheet.flatten(getFeedbackTextStyle()).color}
          />
          <Text style={[styles.feedbackText, getFeedbackTextStyle()]}>
            {feedbackMessage}
          </Text>
        </Animated.View>
      ) : null}
      
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
  feedbackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
    gap: 6,
  },
  feedbackSuccess: {
    backgroundColor: '#d4edda',
    borderColor: '#c3e6cb',
    borderWidth: 1,
  },
  feedbackDuplicate: {
    backgroundColor: '#fafafa',
    borderColor: '#e0e0e0',
    borderWidth: 1,
  },
  feedbackError: {
    backgroundColor: '#f8d7da',
    borderColor: '#f5c6cb',
    borderWidth: 1,
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: '400',
    textAlign: 'center',
    flex: 1,
  },
  feedbackTextSuccess: {
    color: '#155724',
  },
  feedbackTextDuplicate: {
    color: '#757575',
  },
  feedbackTextError: {
    color: '#721c24',
  },
});

export default DocumentUpload;
