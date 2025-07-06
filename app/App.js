import React, { useState, useRef } from 'react';
import { Button, StyleSheet, Text, View, TouchableOpacity, ScrollView, SafeAreaView, TextInput, Platform, Image, FlatList, Alert } from 'react-native';
import { Audio } from 'expo-av';
import { StatusBar } from 'expo-status-bar';
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';
import { auth } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, updateProfile } from 'firebase/auth';
import { formatFileSize, getFileIcon } from './documentService';
import { testStoragePermissions } from './storageTest';
import { checkDocumentsInFirestore } from './firestoreTest';
import { testConversations, testSaveConversation } from './conversationTest';
import { DocumentUpload, DocumentItem, DocumentManagement, ProfilePicture, ConversationItem, ConversationHistory } from './components';

export default function App() {
  const [recording, setRecording] = useState(null);
  const [recordedUri, setRecordedUri] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [sound, setSound] = useState(null);
  const [transcription, setTranscription] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [chatResponse, setChatResponse] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isMicActive, setIsMicActive] = useState(false);
  const [user, setUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [conversationThread, setConversationThread] = useState([]); // New: stores the current conversation thread
  const [threadId, setThreadId] = useState(null); // New: current thread ID
  const [documents, setDocuments] = useState([]);
  const [showDocuments, setShowDocuments] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Initialize Google Auth Provider
  const googleProvider = new GoogleAuthProvider();
  googleProvider.addScope('profile');
  googleProvider.addScope('email');

  // Backend API configuration
  function getBackendApiUrl() {
    // Development: local backend
    if (__DEV__) {
      return 'http://localhost:3001/api';
    }
    // Production: deployed backend URL
    return Constants.expoConfig.extra.backendUrl || 'https://your-backend-url.com/api';
  }

  const BACKEND_API_URL = getBackendApiUrl();
  console.log('Backend API URL:', BACKEND_API_URL);

  const MAIN_HEADING = Constants.expoConfig.extra.mainHeading;

  // Helper function to get user's ID token for API calls
  const getUserToken = async () => {
    if (!user) {
      throw new Error('User not authenticated');
    }
    return await user.getIdToken();
  };

  // Helper function for API calls
  const apiCall = async (endpoint, options = {}) => {
    try {
      console.log('🌐 API Call START:', endpoint, options.method || 'GET');
      console.log('🌐 Full URL will be:', `${BACKEND_API_URL}${endpoint}`);
      
      const token = await getUserToken();
      console.log('🔑 Token obtained, length:', token ? token.length : 0);
      console.log('🔑 Token preview:', token ? `${token.substring(0, 50)}...` : 'null');
      
      // Build headers
      const headers = {
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      };
      
      // Only add Content-Type for requests that typically have a body
      if (options.method && !['GET', 'DELETE'].includes(options.method.toUpperCase())) {
        headers['Content-Type'] = 'application/json';
      }
      
      console.log('📋 Request headers:', headers);
      console.log('📋 Request options:', options);
      
      console.log('🚀 Making fetch request...');
      const response = await fetch(`${BACKEND_API_URL}${endpoint}`, {
        ...options,
        headers,
      });

      console.log('📡 Response received - status:', response.status);
      console.log('📡 Response headers:', Object.fromEntries(response.headers));

      if (!response.ok) {
        console.log('❌ Response not OK, attempting to parse error...');
        const errorData = await response.json().catch((err) => {
          console.log('❌ Failed to parse error response as JSON:', err);
          return {};
        });
        console.error('❌ API Error details:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ API Success:', endpoint, data);
      return data;
    } catch (error) {
      console.error(`❌ API call to ${endpoint} failed:`, error);
      throw error;
    }
  };

  // System prompt for PowerNOVA
  const SYSTEM_PROMPT = "You are PowerNOVA, an expert assistant specialized in power systems, electrical engineering, and related topics such as power generation, transmission, distribution, grid operations, renewable energy, and power system analysis. This includes the regulatory bodies in this area across different jurisdictions.  If a user asks a question outside of these areas, politely respond: 'I'm here to help with power systems and related topics. Please ask a question about electrical power systems, engineering, or energy!'";

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        alert('Permission to access microphone is required!');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecordedUri(uri);
      setRecording(null);
      setTranscription('');
      setChatResponse('');
      // Add a longer delay and log the URI for debugging
      setTimeout(() => {
        if (!uri) {
          setTranscription('Recording failed. No audio file found.');
          return;
        }
        console.log('Recorded URI:', uri);
        transcribeRecording();
      }, 1000); // 1 second delay
    } catch (err) {
      console.error('Failed to stop recording', err);
    }
  };

  const playRecording = async () => {
    if (!recordedUri) return;
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: recordedUri });
      setSound(sound);
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          sound.unloadAsync();
          setSound(null);
        }
      });
    } catch (err) {
      console.error('Failed to play recording', err);
    }
  };

  // Send transcription to backend API with document context and conversation history
  const sendToChat = async (text) => {
    setIsChatLoading(true);
    setChatResponse('');
    
    // Generate or use existing thread ID
    const currentThreadId = threadId || Date.now().toString();
    if (!threadId) {
      setThreadId(currentThreadId);
    }
    
    // Determine if this is a follow-up (if we have an existing thread)
    const isFollowUp = threadId !== null;
    
    // Create a new conversation entry
    const newConversation = {
      id: Date.now().toString(),
      threadId: currentThreadId,
      prompt: text,
      response: '',
      timestamp: new Date(),
      type: transcription ? 'voice' : 'text',
      isLoading: true,
      isFollowUp: isFollowUp,
    };
    
    setCurrentConversation(newConversation);
    
    try {
      // Call backend API
      const response = await apiCall('/chat/message', {
        method: 'POST',
        body: JSON.stringify({
          message: text,
          threadId: currentThreadId,
          isFollowUp: isFollowUp,
        }),
      });

      const responseText = response.response;
      setChatResponse(responseText);
      
      // Update the conversation with response
      const updatedConversation = {
        ...newConversation,
        response: responseText,
        isLoading: false,
      };
      setCurrentConversation(updatedConversation);
      
      // Add to conversation thread
      setConversationThread(prev => [...prev, {
        prompt: text,
        response: responseText,
        timestamp: new Date(),
        id: updatedConversation.id
      }]);
      
    } catch (err) {
      const errorMessage = 'Chat failed. Please try again.';
      setChatResponse(errorMessage);
      const updatedConversation = {
        ...newConversation,
        response: errorMessage,
        isLoading: false,
      };
      setCurrentConversation(updatedConversation);
      console.error('Chat error:', err);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Modified transcription to use backend API
  const transcribeRecording = async () => {
    if (!recordedUri) {
      setTranscription('No audio file to transcribe.');
      return;
    }
    setIsTranscribing(true);
    setTranscription('');
    setChatResponse('');
    
    try {
      if (Platform.OS === 'web') {
        setTranscription('Transcription is not supported on web.');
        setIsTranscribing(false);
        return;
      }

      const fileUri = recordedUri;
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      console.log('File info:', fileInfo);
      
      if (!fileInfo.exists) throw new Error('File does not exist');

      // Create FormData for audio upload
      const formData = new FormData();
      formData.append('audio', {
        uri: fileUri,
        name: getFileName(fileUri),
        type: 'audio/mp4',
      });
      formData.append('autoSend', 'true');

      // Call backend transcription API
      const token = await getUserToken();
      const response = await fetch(`${BACKEND_API_URL}/chat/transcribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Backend transcription error:', errorText);
        throw new Error('Transcription failed');
      }

      const data = await response.json();
      setTranscription(data.transcription || 'No transcription found.');
      
      if (data.response) {
        setChatResponse(data.response);
        
        // Update conversation thread
        if (data.threadId) {
          setThreadId(data.threadId);
          setConversationThread(prev => [...prev, {
            prompt: data.transcription,
            response: data.response,
            timestamp: new Date(),
            id: Date.now().toString()
          }]);
        }
      }
      
    } catch (err) {
      if (Platform.OS === 'ios') {
        setTranscription('Transcription failed. Please check microphone permissions and try again.');
      } else {
        setTranscription('Transcription failed.');
      }
      setChatResponse('');
      console.error('Transcription error:', err);
    } finally {
      setIsTranscribing(false);
    }
  };

  // Helper to get file name from URI
  const getFileName = (uri) => {
    if (!uri) return '';
    return uri.split('/').pop();
  };

  // Add a function to reset the recording and transcription
  const resetRecording = () => {
    setRecordedUri(null);
    setTranscription('');
    setSound(null);
  };

  // Automatically speak chat response when it changes, and stop previous speech
  React.useEffect(() => {
    Speech.stop(); // Stop any ongoing speech before starting new
    if (chatResponse) {
      Speech.speak(chatResponse, { language: 'en' });
    }
  }, [chatResponse]);

  // Handle mic icon press
  const handleMicPress = async () => {
    Speech.stop(); // Stop any ongoing speech
    if (Platform.OS === 'web') {
      alert('Voice recording is not supported on web in this app.');
      return;
    }
    if (!isRecording) {
      setIsMicActive(true);
      await startRecording();
    } else {
      setIsMicActive(false);
      await stopRecording();
    }
  };

  // Stop speech when user types a new prompt
  const handleInputChange = (text) => {
    Speech.stop();
    setInputText(text);
  };

  // Handler for submitting text prompt
  const handleTextInputKeyPress = (e) => {
    if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey && !e.nativeEvent.ctrlKey) {
      // Only submit if input is not empty and not loading
      if (inputText.trim() && !isChatLoading && !isRecording && !isMicActive) {
        const prompt = inputText.trim();
        setInputText('');
        setTranscription('');
        sendToChat(prompt);
      }
      // Prevent default newline
      e.preventDefault && e.preventDefault();
    } else if ((e.nativeEvent.key === 'Enter' && (e.nativeEvent.ctrlKey || e.nativeEvent.shiftKey))) {
      // Allow multi-line input with Ctrl+Enter or Shift+Enter
      setInputText(inputText + '\n');
    }
  };

  // Load conversation history from backend API
  const loadConversationHistory = (userId) => {
    if (!userId) {
      console.log('No user ID provided, clearing conversations');
      setConversations([]);
      return;
    }

    // For now, we'll fetch on demand rather than real-time
    // You could implement WebSocket or polling for real-time updates
    fetchConversationHistory(userId);
  };

  // Fetch conversation history from backend
  const fetchConversationHistory = async (userId) => {
    try {
      console.log('Loading conversation history for user:', userId);
      const response = await apiCall('/chat/history?limit=50');
      
      console.log('📋 Loaded conversations from backend:', response.conversations.length);
      setConversations(response.conversations);
    } catch (error) {
      console.error('❌ Error loading conversations from backend:', error);
      setConversations([]);
    }
  };

  // Load conversation thread from backend API
  const loadConversationThread = async (threadId) => {
    if (!user || !threadId) return;
    
    try {
      console.log('Loading conversation thread:', threadId);
      const response = await apiCall(`/chat/thread/${threadId}`);
      
      setConversationThread(response.thread);
      setThreadId(threadId);
      console.log('Loaded thread messages:', response.thread.length);
    } catch (error) {
      console.error('Error loading conversation thread:', error);
    }
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    const now = new Date();
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  // Clear current conversation
  const clearCurrentConversation = () => {
    setCurrentConversation(null);
    setTranscription('');
    setChatResponse('');
    setRecordedUri(null);
    setSound(null);
    clearConversationThread();
  };

  // Clear conversation thread
  const clearConversationThread = () => {
    setConversationThread([]);
    setThreadId(null);
  };

  // Document upload handler - now uses backend API
  const handleDocumentUpload = async (file) => {
    if (!user) {
      Alert.alert('Error', 'Please sign in to upload documents');
      return;
    }

    setIsUploading(true);
    try {
      console.log('📤 Starting document upload:', file);
      
      // Create FormData for file upload
      const formData = new FormData();
      
      // Handle different file formats for web vs native
      if (Platform.OS === 'web') {
        // For web, the file should be a File object
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

      // Upload via backend API - don't set Content-Type header manually
      const token = await getUserToken();
      const response = await fetch(`${BACKEND_API_URL}/documents/upload`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type - let browser set it with boundary
        },
      });

      console.log('📡 Upload response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Upload error:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Document uploaded successfully:', data);
      Alert.alert('Success', 'Document uploaded successfully!');
      // Refresh documents list
      loadUserDocuments();
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Upload Error', error.message || 'Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  // Document deletion handler
  const handleDocumentDelete = async (document) => {
    console.log('🗑️  Delete handler called with document:', document);
    console.log('🗑️  Backend API URL:', BACKEND_API_URL);
    console.log('🗑️  User authenticated:', !!user);
    console.log('🗑️  User UID:', user?.uid);
    console.log('🗑️  Platform:', Platform.OS);
    console.log('🗑️  Alert function available:', typeof Alert.alert);
    
    // Test if Alert works at all
    try {
      console.log('🗑️  Attempting to show alert...');
      
      // For web platform, use window.confirm as fallback
      if (Platform.OS === 'web') {
        console.log('🗑️  Using web confirm dialog');
        const confirmed = window.confirm(`Are you sure you want to delete "${document.fileName}"?`);
        console.log('🗑️  Web confirm result:', confirmed);
        
        if (confirmed) {
          console.log('🗑️  User confirmed deletion via web dialog - starting deletion process...');
          await performDeletion(document);
        } else {
          console.log('🗑️  Delete cancelled by user via web dialog');
        }
      } else {
        console.log('🗑️  Using React Native Alert');
        Alert.alert(
          'Delete Document',
          `Are you sure you want to delete "${document.fileName}"?`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => console.log('🗑️  Delete cancelled by user') },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                console.log('🗑️  User confirmed deletion - starting deletion process...');
                await performDeletion(document);
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('❌ Error showing alert:', error);
      // Fallback to direct deletion with console confirmation
      console.log('🗑️  Alert failed, proceeding with deletion (development mode)');
      await performDeletion(document);
    }
  };

  // Separate function to perform the actual deletion
  const performDeletion = async (document) => {
    try {
      console.log('🗑️  Starting deletion for document ID:', document.id);
      console.log('🗑️  Document owner (userId):', document.userId);
      console.log('🗑️  Document owner (uid):', document.uid);
      console.log('🗑️  Current user:', user?.uid);
      
      console.log('🗑️  About to call apiCall with endpoint:', `/documents/${document.id}`);
      
      // Use backend API for deletion to ensure proper cleanup
      const response = await apiCall(`/documents/${document.id}`, {
        method: 'DELETE'
      });
      
      console.log('✅ Document deleted successfully, response:', response);
      
      // Show success message
      if (Platform.OS === 'web') {
        window.alert('Document deleted successfully!');
      } else {
        Alert.alert('Success', 'Document deleted successfully!');
      }
      
      // Refresh documents list
      console.log('🔄 Refreshing documents list...');
      loadUserDocuments();
    } catch (error) {
      console.error('❌ Delete error:', error);
      console.error('❌ Delete error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // Show error message
      const errorMessage = error.message || 'Failed to delete document';
      if (Platform.OS === 'web') {
        window.alert(`Delete Error: ${errorMessage}`);
      } else {
        Alert.alert('Delete Error', errorMessage);
      }
    }
  };

  // Load documents when user changes
  React.useEffect(() => {
    console.log('User effect triggered, user:', user?.uid || 'none');
    
    if (user) {
      console.log('Loading documents for user:', user.uid);
      loadUserDocuments();
    } else {
      console.log('No user, clearing documents');
      setDocuments([]);
    }
  }, [user]);

  // Load user documents from backend
  const loadUserDocuments = async () => {
    try {
      const response = await apiCall('/documents');
      const userDocuments = response.documents || [];
      console.log('📄 Raw documents from API:', userDocuments);
      
      // Convert date strings back to Date objects
      const processedDocuments = userDocuments.map(doc => ({
        ...doc,
        uploadedAt: doc.uploadedAt ? new Date(doc.uploadedAt) : new Date()
      }));
      
      console.log('📄 Processed documents:', processedDocuments);
      setDocuments(processedDocuments);
    } catch (error) {
      console.error('Error loading documents:', error);
      setDocuments([]);
    }
  };

  // Load conversation history when user signs in/out
  React.useEffect(() => {
    console.log('User state changed:', user?.uid || 'signed out');
    
    if (user) {
      try {
        loadConversationHistory(user.uid);
      } catch (error) {
        console.error('Failed to load conversation history:', error);
        setConversations([]);
      }
    } else {
      setConversations([]);
    }
  }, [user]);

  // Google Sign-In Function
  const handleGoogleSignIn = async () => {
    try {
      console.log('Starting Google sign-in...');
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      console.log('Google sign-in successful:', user);
      setUser(user);
    } catch (error) {
      console.error('Google sign-in error:', error);
      if (error.code === 'auth/popup-blocked') {
        alert('Popup blocked. Please allow popups for this site and try again.');
      } else if (error.code === 'auth/popup-closed-by-user') {
        console.log('User closed the popup');
      } else {
        alert('Sign-in failed: ' + error.message);
      }
    }
  };

  // Setup auth state listener
  React.useEffect(() => {
    console.log('Setting up auth state listener');
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('Auth state changed:', user ? {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL
      } : 'null');
      setUser(user);
    }, (error) => {
      console.error('Auth state change error:', error);
    });
    
    return () => {
      console.log('Cleaning up auth listener');
      unsubscribe();
    };
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.outerContainer}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.heading}>{MAIN_HEADING}</Text>
          </View>
          <View style={styles.headerRight}>
            {user ? (
              <>
                <TouchableOpacity
                  style={styles.historyButton}
                  onPress={() => setShowHistory(true)}
                >
                  <Ionicons name="time-outline" size={20} color="#007AFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.documentsButton}
                  onPress={() => setShowDocuments(true)}
                >
                  <Ionicons name="document-text-outline" size={20} color="#007AFF" />
                  {documents.length > 0 ? (
                    <View style={styles.documentBadge}>
                      <Text style={styles.documentBadgeText}>{documents.length}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              </>
            ) : null}
            {user ? (
              <View style={styles.userInfoRow}>
                <ProfilePicture user={user} />
                <View style={styles.userNameContainer}>
                  <Text style={styles.userName}>{user.displayName || 'User'}</Text>
                  <Text style={styles.userStatus}>Signed in</Text>
                </View>
                <TouchableOpacity
                  style={styles.signOutButton}
                  onPress={() => {
                    signOut(auth);
                    clearCurrentConversation();
                  }}
                >
                  <Ionicons name="log-out-outline" size={16} color="#fff" style={styles.signOutIcon} />
                  <Text style={styles.signOutText}>Sign Out</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.signInButton}
                onPress={handleGoogleSignIn}
              >
                <Ionicons name="logo-google" size={20} color="#fff" style={styles.googleIcon} />
                <Text style={styles.signInText}>Sign in with Google</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        {/* Show conversation history, document management, or main chat */}
        {showHistory ? (
          <ConversationHistory 
            conversations={conversations}
            onClose={() => setShowHistory(false)}
            onConversationSelect={(conversation) => {
              setTranscription(conversation.transcription || '');
              setChatResponse(conversation.response);
              setCurrentConversation(conversation);
              setShowHistory(false);
              
              // Load conversation thread if it exists
              if (conversation.threadId) {
                loadConversationThread(conversation.threadId);
              }
            }}
            formatTimestamp={formatTimestamp}
          />
        ) : showDocuments ? (
          <DocumentManagement
            documents={documents}
            onUpload={handleDocumentUpload}
            onDelete={handleDocumentDelete}
            onClose={() => setShowDocuments(false)}
            isUploading={isUploading}
          />
        ) : (
          <>
            <View style={styles.middleSection}>
              <ScrollView style={styles.middleScroll} contentContainerStyle={styles.middleScrollContent}>
                {/* Clear conversation button */}
                {(currentConversation || transcription || chatResponse) ? (
                  <TouchableOpacity style={styles.clearButton} onPress={clearCurrentConversation}>
                    <Ionicons name="refresh-outline" size={18} color="#007AFF" />
                    <Text style={styles.clearButtonText}>New Conversation</Text>
                  </TouchableOpacity>
                ) : null}
                
                {/* Current conversation display */}
                {isChatLoading ? (
                  <View style={styles.messageContainer}>
                    <View style={styles.assistantMessage}>
                      <Text style={styles.chatLoading}>PowerNOVA is thinking...</Text>
                    </View>
                  </View>
                ) : chatResponse ? (
                  <View style={styles.messageContainer}>
                    <View style={styles.assistantMessage}>
                      <Text style={styles.chatResponse}>{chatResponse}</Text>
                    </View>
                  </View>
                ) : null}
                
                {transcription ? (
                  <View style={styles.messageContainer}>
                    <View style={styles.userMessage}>
                      <Text style={styles.transcriptionText}>{transcription}</Text>
                      {currentConversation?.type === 'voice' ? (
                        <Ionicons name="mic" size={16} color="#007AFF" style={styles.messageIcon} />
                      ) : null}
                    </View>
                  </View>
                ) : null}
                
                {/* Full conversation thread display */}
                {conversationThread.length > 0 ? (
                  <View style={styles.threadContainer}>
                    <Text style={styles.threadTitle}>Conversation History</Text>
                    {conversationThread.map((message, index) => (
                      <View key={message.id || index} style={styles.threadMessage}>
                        <View style={styles.threadUserMessage}>
                          <Text style={styles.threadUserText}>{message.prompt}</Text>
                        </View>
                        <View style={styles.threadAssistantMessage}>
                          <Text style={styles.threadAssistantText}>{message.response}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}
                
                {/* Welcome message for new users */}
                {!currentConversation && !transcription && !chatResponse ? (
                  <View style={styles.welcomeContainer}>
                    <Text style={styles.welcomeText}>Welcome to PowerNOVA!</Text>
                    <Text style={styles.welcomeSubtext}>
                      I'm here to help with power systems and electrical engineering questions.
                      You can type your question or use the microphone to speak.
                    </Text>
                    {user && documents.length > 0 ? (
                      <Text style={styles.documentHintText}>
                        💡 You have {documents.length} document{documents.length > 1 ? 's' : ''} uploaded.
                        Ask questions about your documents for more detailed answers!
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </ScrollView>
            </View>
            
            <View style={styles.inputSection}>
              <TextInput
                style={styles.textInput}
                value={inputText}
                onChangeText={handleInputChange}
                placeholder="Ask about power systems..."
                editable={!isRecording && !isMicActive}
                multiline
                blurOnSubmit={false}
                onKeyPress={handleTextInputKeyPress}
              />
              <TouchableOpacity
                style={[styles.micButton, isMicActive && styles.micActive]}
                onPress={handleMicPress}
                disabled={isTranscribing || isChatLoading}
              >
                <Ionicons name={isMicActive ? 'mic-off' : 'mic'} size={28} color="#fff" />
              </TouchableOpacity>
            </View>
          </>
        )}
        
        <StatusBar style="auto" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  outerContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#222',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    minHeight: 60,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historyButton: {
    backgroundColor: '#f0f0f0',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  documentsButton: {
    backgroundColor: '#f0f0f0',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    position: 'relative',
  },
  documentBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  documentBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  middleSection: {
    flex: 1,
    width: '100%',
    minHeight: 120,
    maxHeight: '100%',
    paddingHorizontal: 0,
  },
  middleScroll: {
    width: '100%',
    flex: 1,
    paddingHorizontal: 16,
  },
  middleScrollContent: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingBottom: 20,
  },
  welcomeContainer: {
    alignItems: 'center',
    padding: 32,
    marginTop: 60,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#222',
    textAlign: 'center',
    marginBottom: 12,
  },
  welcomeSubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  documentHintText: {
    fontSize: 14,
    color: '#007AFF',
    textAlign: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  messageContainer: {
    width: '100%',
    marginVertical: 8,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    maxWidth: '80%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    maxWidth: '80%',
  },
  messageIcon: {
    marginLeft: 8,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
    alignSelf: 'center',
  },
  clearButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  inputSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 24,
    width: '100%',
    backgroundColor: '#fff',
  },
  textInput: {
    flex: 1,
    height: 48,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    marginRight: 12,
    textAlignVertical: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButton: {
    backgroundColor: '#007AFF',
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micActive: {
    backgroundColor: '#FF3B30',
  },
  transcriptionText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
  },
  chatResponse: {
    color: '#222',
    fontSize: 16,
    lineHeight: 22,
  },
  chatLoading: {
    color: '#007AFF',
    fontSize: 16,
    fontStyle: 'italic',
  },

  // Auth and profile styles
  signInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4285F4',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    maxWidth: '70%',
  },
  signInText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  googleIcon: {
    marginRight: 4,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF3B30',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  signOutText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  signOutIcon: {
    marginRight: 2,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '70%',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },

  userNameContainer: {
    flex: 1,
    marginRight: 8,
  },
  userName: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '600',
    marginBottom: 2,
  },
  userStatus: {
    fontSize: 11,
    color: '#28a745',
    fontWeight: '500',
  },

  // Conversation thread styles
  threadContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginHorizontal: 16,
  },
  threadTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  threadMessage: {
    marginBottom: 12,
  },
  threadUserMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 4,
    maxWidth: '80%',
  },
  threadUserText: {
    color: '#fff',
    fontSize: 14,
  },
  threadAssistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#e9ecef',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '80%',
  },
  threadAssistantText: {
    color: '#333',
    fontSize: 14,
  },
});
