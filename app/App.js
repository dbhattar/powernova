import React, { useState, useRef } from 'react';
import { Button, StyleSheet, Text, View, TouchableOpacity, ScrollView, SafeAreaView, TextInput, Platform, Image, FlatList, Alert } from 'react-native';
import { Audio } from 'expo-av';
import { StatusBar } from 'expo-status-bar';
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';
import { auth, db, storage } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, updateProfile } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, updateDoc, doc, getDocs } from 'firebase/firestore';
import { DocumentService, formatFileSize, getFileIcon } from './documentService';
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
  const [documentService, setDocumentService] = useState(null);
  const [showFollowUpInput, setShowFollowUpInput] = useState(false); // New: show follow-up input
  const [followUpText, setFollowUpText] = useState(''); // New: follow-up question text

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
      const token = await getUserToken();
      const response = await fetch(`${BACKEND_API_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API call to ${endpoint} failed:`, error);
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
  const sendToChat = async (text, isFollowUp = false) => {
    setIsChatLoading(true);
    setChatResponse('');
    
    // Generate or use existing thread ID
    const currentThreadId = threadId || Date.now().toString();
    if (!threadId) {
      setThreadId(currentThreadId);
    }
    
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

  // Handle follow-up question
  const handleFollowUpSend = async () => {
    if (!followUpText.trim() || isChatLoading) return;
    
    const followUpQuestion = followUpText.trim();
    setFollowUpText('');
    setShowFollowUpInput(false);
    
    // Send as follow-up question
    await sendToChat(followUpQuestion, true);
  };

  // Clear conversation thread
  const clearConversationThread = () => {
    setConversationThread([]);
    setThreadId(null);
    setShowFollowUpInput(false);
    setFollowUpText('');
  };

  // Document upload handler
  const handleDocumentUpload = async (file) => {
    if (!user || !documentService) {
      Alert.alert('Error', 'Please sign in to upload documents');
      return;
    }

    setIsUploading(true);
    try {
      const uploadedDoc = await documentService.uploadDocument(file);
      console.log('Document uploaded successfully:', uploadedDoc);
      Alert.alert('Success', 'Document uploaded successfully!');
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Upload Error', error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Document deletion handler
  const handleDocumentDelete = async (document) => {
    if (!documentService) return;

    Alert.alert(
      'Delete Document',
      `Are you sure you want to delete "${document.fileName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await documentService.deleteDocument(document.id, document.filePath);
              console.log('Document deleted successfully');
            } catch (error) {
              console.error('Delete error:', error);
              Alert.alert('Delete Error', error.message);
            }
          }
        }
      ]
    );
  };

  // Initialize document service when user changes
  React.useEffect(() => {
    console.log('User effect triggered, user:', user?.uid || 'none');
    
    if (user) {
      console.log('Creating document service for user:', user.uid);
      const service = new DocumentService(user.uid);
      setDocumentService(service);
      
      // Subscribe to user's documents
      console.log('Setting up document subscription...');
      const unsubscribe = service.subscribeToDocuments((docs) => {
        console.log('Documents updated in App:', docs.length);
        setDocuments(docs);
      });
      
      return () => {
        console.log('Cleaning up document subscription');
        if (unsubscribe) unsubscribe();
      };
    } else {
      console.log('No user, clearing document service and documents');
      setDocumentService(null);
      setDocuments([]);
    }
  }, [user]);

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
            {user && (
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
                  {documents.length > 0 && (
                    <View style={styles.documentBadge}>
                      <Text style={styles.documentBadgeText}>{documents.length}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </>
            )}
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
                {(currentConversation || transcription || chatResponse) && (
                  <TouchableOpacity style={styles.clearButton} onPress={clearCurrentConversation}>
                    <Ionicons name="refresh-outline" size={18} color="#007AFF" />
                    <Text style={styles.clearButtonText}>New Conversation</Text>
                  </TouchableOpacity>
                )}
                
                {/* Current conversation display */}
                {transcription ? (
                  <View style={styles.messageContainer}>
                    <View style={styles.userMessage}>
                      <Text style={styles.transcriptionText}>{transcription}</Text>
                      {currentConversation?.type === 'voice' && (
                        <Ionicons name="mic" size={16} color="#007AFF" style={styles.messageIcon} />
                      )}
                    </View>
                  </View>
                ) : null}
                
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
                      {/* Follow-up question section */}
                      <View style={styles.followUpContainer}>
                        <TouchableOpacity 
                          style={styles.followUpButton}
                          onPress={() => setShowFollowUpInput(true)}
                        >
                          <Ionicons name="chatbubbles-outline" size={16} color="#007AFF" />
                          <Text style={styles.followUpButtonText}>Ask Follow-up</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ) : null}
                
                {/* Follow-up input section */}
                {showFollowUpInput && (
                  <View style={styles.followUpInputContainer}>
                    <TextInput
                      style={styles.followUpInput}
                      value={followUpText}
                      onChangeText={setFollowUpText}
                      placeholder="Ask a follow-up question..."
                      multiline
                      autoFocus
                    />
                    <View style={styles.followUpActions}>
                      <TouchableOpacity
                        style={styles.followUpCancelButton}
                        onPress={() => {
                          setShowFollowUpInput(false);
                          setFollowUpText('');
                        }}
                      >
                        <Text style={styles.followUpCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.followUpSendButton, (!followUpText.trim() || isChatLoading) && styles.followUpSendButtonDisabled]}
                        onPress={handleFollowUpSend}
                        disabled={!followUpText.trim() || isChatLoading}
                      >
                        <Text style={styles.followUpSendText}>Send</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                
                {/* Conversation thread display */}
                {conversationThread.length > 0 && (
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
                )}
                
                {/* Welcome message for new users */}
                {!currentConversation && !transcription && !chatResponse && (
                  <View style={styles.welcomeContainer}>
                    <Text style={styles.welcomeText}>Welcome to PowerNOVA!</Text>
                    <Text style={styles.welcomeSubtext}>
                      I'm here to help with power systems and electrical engineering questions.
                      You can type your question or use the microphone to speak.
                    </Text>
                    {user && documents.length > 0 && (
                      <Text style={styles.documentHintText}>
                        💡 You have {documents.length} document{documents.length > 1 ? 's' : ''} uploaded. 
                        Ask questions about your documents for more detailed answers!
                      </Text>
                    )}
                  </View>
                )}
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

  
  // Follow-up styles
  followUpContainer: {
    marginTop: 12,
    alignItems: 'flex-start',
  },
  followUpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    gap: 6,
  },
  followUpButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  followUpInputContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    margin: 16,
    padding: 12,
  },
  followUpInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 40,
    maxHeight: 120,
    textAlignVertical: 'top',
  },
  followUpActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  followUpCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  followUpCancelText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  followUpSendButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  followUpSendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  followUpSendText: {
    color: '#fff',
    fontSize: 14,
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
