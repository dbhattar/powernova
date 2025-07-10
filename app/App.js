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
import Markdown from 'react-native-markdown-display';
import { formatFileSize, getFileIcon } from './documentService';
import { testStoragePermissions } from './storageTest';
import { checkDocumentsInFirestore } from './firestoreTest';
import { testConversations, testSaveConversation } from './conversationTest';
import { DocumentUpload, DocumentItem, DocumentManagement, ProfilePicture, ConversationItem, ConversationHistory, ProjectDashboard, ProjectDetails, ProjectSearch } from './components';
// New imports for enhanced UI
import { MainLayout } from './components/Layout';
import { DashboardScreen, ProfileScreen } from './screens';
import { Sidebar } from './components/ui';
import { webSocketService } from './services/webSocketService';

export default function App() {
  const [recording, setRecording] = useState(null);
  const [recordedUri, setRecordedUri] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [sound, setSound] = useState(null);
  const [transcription, setTranscription] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [chatResponse, setChatResponse] = useState('');
  const [currentResponseData, setCurrentResponseData] = useState(null); // Store current response metadata
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isMicActive, setIsMicActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentlySpeakingText, setCurrentlySpeakingText] = useState(null);
  const [user, setUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [conversationThread, setConversationThread] = useState([]); // New: stores the current conversation thread
  const [threadId, setThreadId] = useState(null); // New: current thread ID
  const [documents, setDocuments] = useState([]);
  const [showDocuments, setShowDocuments] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRefreshingDocuments, setIsRefreshingDocuments] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [showProjectSearch, setShowProjectSearch] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  // New state for enhanced UI
  const [currentPanel, setCurrentPanel] = useState('dashboard');
  const [showSidebar, setShowSidebar] = useState(false);

  // Initialize Google Auth Provider
  const googleProvider = new GoogleAuthProvider();
  googleProvider.addScope('profile');
  googleProvider.addScope('email');

  // Backend API configuration
  function getBackendApiUrl() {
    // Development: local backend
    if (__DEV__) {
      return `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:9000'}/api`;
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
      if (Platform.OS === 'web') {
        // Web implementation using MediaRecorder API
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          alert('Audio recording is not supported in this browser.');
          return;
        }
        
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        const chunks = [];
        
        mediaRecorder.addEventListener('dataavailable', (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        });
        
        mediaRecorder.addEventListener('stop', () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          const url = URL.createObjectURL(blob);
          setRecordedUri(url);
          // Stop all tracks to release microphone
          stream.getTracks().forEach(track => track.stop());
          
          // Auto-transcribe after recording stops, passing the URI directly
          setTimeout(() => {
            transcribeRecording(url);
          }, 500);
        });
        
        mediaRecorder.start();
        setRecording(mediaRecorder);
        setIsRecording(true);
      } else {
        // Mobile implementation using Expo Audio
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
      }
    } catch (err) {
      console.error('Failed to start recording', err);
      alert('Failed to start recording. Please check your microphone permissions.');
    }
  };

  const stopRecording = async () => {
    try {
      setIsRecording(false);
      
      if (Platform.OS === 'web') {
        // Web implementation
        if (recording && recording.stop) {
          recording.stop();
        }
        setRecording(null);
        setTranscription('');
        setChatResponse('');
      } else {
        // Mobile implementation
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
          transcribeRecording(uri);
        }, 1000); // 1 second delay
      }
    } catch (err) {
      console.error('Failed to stop recording', err);
    }
  };

  const playRecording = async (audioUri = null) => {
    const uriToPlay = audioUri || recordedUri;
    if (!uriToPlay) return;
    
    try {
      if (Platform.OS === 'web') {
        // Web implementation using HTML5 Audio
        const audio = new window.Audio(uriToPlay);
        audio.play();
        setSound(audio);
        audio.onended = () => {
          setSound(null);
        };
      } else {
        // Mobile implementation using Expo Audio
        const { sound } = await Audio.Sound.createAsync({ uri: uriToPlay });
        setSound(sound);
        await sound.playAsync();
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish) {
            sound.unloadAsync();
            setSound(null);
          }
        });
      }
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
      
      // Store current response data for immediate access
      setCurrentResponseData({
        sourceDocuments: response.sourceDocuments,
        hasReferences: response.hasReferences,
        referenceSummary: response.referenceSummary,
        documentSources: response.documentSources
      });
      
      // Update the conversation with response
      const updatedConversation = {
        ...newConversation,
        response: responseText,
        isLoading: false,
        sourceDocuments: response.sourceDocuments,
        hasReferences: response.hasReferences,
        referenceSummary: response.referenceSummary,
        documentSources: response.documentSources
      };
      setCurrentConversation(updatedConversation);
      
      // Add to conversation thread
      setConversationThread(prev => [...prev, {
        prompt: text,
        response: responseText,
        timestamp: new Date(),
        id: updatedConversation.id,
        type: transcription ? 'voice' : 'text',
        audioUri: transcription ? recordedUri : null,
        sourceDocuments: response.sourceDocuments,
        hasReferences: response.hasReferences,
        referenceSummary: response.referenceSummary,
        documentSources: response.documentSources
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
  const transcribeRecording = async (audioUri = null) => {
    const uriToTranscribe = audioUri || recordedUri;
    if (!uriToTranscribe) {
      setTranscription('No audio file to transcribe.');
      return;
    }
    setIsTranscribing(true);
    setTranscription('');
    setChatResponse('');
    
    try {
      const formData = new FormData();
      
      if (Platform.OS === 'web') {
        // Web implementation: convert blob URL to blob
        const response = await fetch(uriToTranscribe);
        const blob = await response.blob();
        
        // Create a new blob with the correct MIME type if needed
        const audioBlob = new Blob([blob], { type: 'audio/webm' });
        
        // Create a File object instead of just a blob for better compatibility
        const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });
        formData.append('audio', audioFile);
      } else {
        // Mobile implementation
        const fileUri = uriToTranscribe;
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        console.log('File info:', fileInfo);
        
        if (!fileInfo.exists) throw new Error('File does not exist');

        formData.append('audio', {
          uri: fileUri,
          name: getFileName(fileUri),
          type: 'audio/mp4',
        });
      }
      
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
        
        // Store current response data for immediate access
        setCurrentResponseData({
          sourceDocuments: data.sourceDocuments,
          hasReferences: data.hasReferences,
          referenceSummary: data.referenceSummary,
          documentSources: data.documentSources
        });
        
        // Update conversation thread
        if (data.threadId) {
          setThreadId(data.threadId);
          setConversationThread(prev => [...prev, {
            prompt: data.transcription,
            response: data.response,
            timestamp: new Date(),
            id: Date.now().toString(),
            type: 'voice',
            audioUri: uriToTranscribe,
            sourceDocuments: data.sourceDocuments,
            hasReferences: data.hasReferences,
            referenceSummary: data.referenceSummary,
            documentSources: data.documentSources
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

  // Stop speech function
  const stopSpeech = () => {
    Speech.stop();
    setIsSpeaking(false);
    setCurrentlySpeakingText(null);
  };

  // Play specific text function
  const playText = (text) => {
    Speech.stop(); // Stop any ongoing speech
    setIsSpeaking(true);
    setCurrentlySpeakingText(text);
    Speech.speak(text, { 
      language: 'en',
      onDone: () => {
        setIsSpeaking(false);
        setCurrentlySpeakingText(null);
      },
      onStopped: () => {
        setIsSpeaking(false);
        setCurrentlySpeakingText(null);
      },
      onError: () => {
        setIsSpeaking(false);
        setCurrentlySpeakingText(null);
      }
    });
  };

  // Stop specific text function
  const stopText = (text) => {
    if (currentlySpeakingText === text) {
      stopSpeech();
    }
  };

  // Check if specific text is currently being spoken
  const isTextSpeaking = (text) => {
    return isSpeaking && currentlySpeakingText === text;
  };

  // Automatically speak chat response when it changes, and stop previous speech
  React.useEffect(() => {
    Speech.stop(); // Stop any ongoing speech before starting new
    if (chatResponse) {
      setIsSpeaking(true);
      setCurrentlySpeakingText(chatResponse);
      Speech.speak(chatResponse, { 
        language: 'en',
        onDone: () => {
          setIsSpeaking(false);
          setCurrentlySpeakingText(null);
        },
        onStopped: () => {
          setIsSpeaking(false);
          setCurrentlySpeakingText(null);
        },
        onError: () => {
          setIsSpeaking(false);
          setCurrentlySpeakingText(null);
        }
      });
    }
  }, [chatResponse]);

  // Handle mic icon press
  const handleMicPress = async () => {
    stopSpeech(); // Stop any ongoing speech
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
    stopSpeech();
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
      
      // Ensure each thread message has proper type information
      const threadWithTypes = response.thread.map(message => ({
        ...message,
        type: message.type || (message.audioUri ? 'voice' : 'text'),
        audioUri: message.audioUri || null
      }));
      
      setConversationThread(threadWithTypes);
      setThreadId(threadId);
      console.log('Loaded thread messages:', threadWithTypes.length);
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
    stopSpeech(); // Stop any ongoing speech
    setCurrentConversation(null);
    setTranscription('');
    setChatResponse('');
    setCurrentResponseData(null); // Clear current response data
    setRecordedUri(null);
    setSound(null);
    clearConversationThread();
  };

  // Clear conversation thread
  const clearConversationThread = () => {
    setConversationThread([]);
    setThreadId(null);
  };

  // Navigation function to handle switching between panels
  const navigateToPanel = (panel) => {
    // Close all panels first
    setShowHistory(false);
    setShowDocuments(false);
    setShowProjects(false);
    setShowProjectSearch(false);
    setSelectedProject(null);
    setShowProfile(false);
    
    // Set current panel for new UI
    setCurrentPanel(panel);
    
    // Open the requested panel
    switch (panel) {
      case 'history':
        setShowHistory(true);
        break;
      case 'documents':
        setShowDocuments(true);
        break;
      case 'projects':
        setShowProjects(true);
        break;
      case 'search':
        setShowProjectSearch(true);
        break;
      case 'dashboard':
        // Dashboard will be handled by the new UI
        break;
      case 'profile':
        setShowProfile(true);
        break;
      case 'chat':
      default:
        // Stay in chat interface - all panels are already closed above
        break;
    }
  };

  // Document upload handler - now uses backend API
  const handleDocumentUpload = async (result) => {
    if (!user) {
      Alert.alert('Error', 'Please sign in to upload documents');
      return;
    }

    try {
      console.log('📤 Document upload result received:', result);
      
      if (result.isDuplicate || result.isExisting) {
        console.log('🔄 Duplicate file - refreshing document list');
        // For duplicates, just refresh the list to potentially highlight the existing document
        await loadUserDocuments(true);
      } else {
        console.log('✅ New document uploaded - refreshing document list');
        // For new uploads, refresh the document list
        await loadUserDocuments(true);
      }
    } catch (error) {
      console.error('Error handling upload result:', error);
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
  const loadUserDocuments = async (showLoader = false) => {
    if (showLoader) {
      setIsRefreshingDocuments(true);
    }
    
    try {
      console.log('📄 Loading user documents...');
      const response = await apiCall('/documents');
      const userDocuments = response.documents || [];
      console.log('📄 Raw documents from API:', userDocuments);
      
      // Convert date strings back to Date objects
      const processedDocuments = userDocuments.map(doc => ({
        ...doc,
        uploadedAt: doc.uploadedAt ? new Date(doc.uploadedAt) : new Date()
      }));
      
      console.log('📄 Processed documents:', processedDocuments);
      
      // Log status for debugging
      processedDocuments.forEach(doc => {
        console.log(`📄 Document ${doc.fileName}: status=${doc.status}, isCompleted=${doc.status === 'completed'}`);
      });
      
      setDocuments(processedDocuments);
    } catch (error) {
      console.error('❌ Error loading documents:', error);
      setDocuments([]);
    } finally {
      if (showLoader) {
        setIsRefreshingDocuments(false);
      }
    }
  };

  // Auto-refresh documents to show status updates  
  React.useEffect(() => {
    if (!user) {
      console.log('📄 Auto-refresh: Skipping - no user');
      return;
    }

    console.log('📄 Auto-refresh: Checking if refresh needed...');
    console.log('📄 Auto-refresh: User:', user.uid);
    console.log('📄 Auto-refresh: Documents count:', documents.length);

    // Always set up refresh if user is present - we'll check processing status inside the interval
    console.log('📄 Auto-refresh: Setting up refresh timer (every 5 seconds for debugging)');
    
    // Set up interval to check for status updates every 5 seconds (faster for debugging)
    const refreshInterval = setInterval(() => {
      // Check if we have any processing documents before refreshing
      const hasProcessingDocs = documents.some(doc => 
        doc.status === 'processing' || 
        doc.status === 'queued_for_processing' ||
        doc.status === 'queued' ||
        (doc.status !== 'completed' && doc.status !== 'failed')
      );

      if (hasProcessingDocs) {
        console.log('📄 Auto-refresh: Timer triggered - found processing docs, refreshing...');
        loadUserDocuments();
      } else {
        console.log('📄 Auto-refresh: Timer triggered - no processing docs, skipping refresh');
      }
    }, 5000); // 5 seconds for debugging

    // Clean up interval after 5 minutes for debugging
    const maxRefreshTimeout = setTimeout(() => {
      console.log('📄 Auto-refresh: Maximum refresh time reached, stopping auto-refresh');
      clearInterval(refreshInterval);
    }, 300000); // 5 minutes

    return () => {
      console.log('📄 Auto-refresh: Cleaning up timers');
      clearInterval(refreshInterval);
      clearTimeout(maxRefreshTimeout);
    };
  }, [user?.uid]); // Only depend on user ID, not documents array

  // WebSocket setup for real-time document updates
  React.useEffect(() => {
    if (!user) return;

    let cleanup = null;

    const setupWebSocket = async () => {
      try {
        console.log('📡 Setting up WebSocket for document updates...');
        await webSocketService.connect();
        
        // Listen for document processing updates
        const handleDocumentProcessed = (data) => {
          console.log('📄 WebSocket: Document processed event received:', data);
          // Refresh documents list when we get an update
          loadUserDocuments();
        };

        const handleJobProgress = (data) => {
          console.log('📄 WebSocket: Job progress event received:', data);
          // Refresh on completion or failure
          if (data.status === 'completed' || data.status === 'failed') {
            console.log('📄 WebSocket: Job completed/failed, refreshing documents...');
            loadUserDocuments();
          }
        };

        const handleMessage = (message) => {
          console.log('📄 WebSocket: Raw message received:', message);
          // Handle different message types that might be sent
          if (message.type === 'document_status_update' || message.type === 'document_processed') {
            console.log('📄 WebSocket: Document status update detected, refreshing...');
            loadUserDocuments();
          }
        };

        // Register multiple event listeners to catch different event types
        webSocketService.on('document_processed', handleDocumentProcessed);
        webSocketService.on('job_progress', handleJobProgress);
        webSocketService.on('message', handleMessage);

        console.log('✅ WebSocket listeners registered for document updates');

        // Return cleanup function
        cleanup = () => {
          console.log('🧹 Cleaning up WebSocket listeners...');
          webSocketService.off('document_processed', handleDocumentProcessed);
          webSocketService.off('job_progress', handleJobProgress);
          webSocketService.off('message', handleMessage);
        };

        return cleanup;
      } catch (error) {
        console.error('❌ Failed to setup WebSocket for document updates:', error);
      }
    };

    setupWebSocket();
    
    return () => {
      if (cleanup && typeof cleanup === 'function') {
        cleanup();
      }
    };
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
      <MainLayout 
        user={user} 
        currentRoute={currentPanel}
        onNavigate={navigateToPanel}
      >
        <View style={styles.outerContainer}>
          {/* Enhanced Header Row */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.heading}>{MAIN_HEADING}</Text>
            </View>
            <View style={styles.headerRight}>
              {user ? (
                <>
                  <TouchableOpacity
                    style={[styles.navButton, currentPanel === 'dashboard' && styles.navButtonActive]}
                    onPress={() => navigateToPanel('dashboard')}
                  >
                    <Ionicons 
                      name={currentPanel === 'dashboard' ? "home" : "home-outline"} 
                      size={18} 
                      color={currentPanel === 'dashboard' ? "#007AFF" : "#666"} 
                    />
                    <Text style={[styles.navButtonText, currentPanel === 'dashboard' && styles.navButtonTextActive]}>
                      Dashboard
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.navButton, currentPanel === 'chat' && styles.navButtonActive]}
                    onPress={() => navigateToPanel('chat')}
                  >
                    <Ionicons 
                      name={currentPanel === 'chat' ? "chatbubble" : "chatbubble-outline"} 
                      size={18} 
                      color={currentPanel === 'chat' ? "#007AFF" : "#666"} 
                    />
                    <Text style={[styles.navButtonText, currentPanel === 'chat' && styles.navButtonTextActive]}>
                      Chat
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.navButton, currentPanel === 'documents' && styles.navButtonActive]}
                    onPress={() => navigateToPanel('documents')}
                  >
                    <Ionicons 
                      name={currentPanel === 'documents' ? "document-text" : "document-text-outline"} 
                      size={18} 
                      color={currentPanel === 'documents' ? "#007AFF" : "#666"} 
                    />
                    <Text style={[styles.navButtonText, currentPanel === 'documents' && styles.navButtonTextActive]}>
                      Documents
                    </Text>
                    {documents.length > 0 ? (
                      <View style={styles.documentBadge}>
                        <Text style={styles.documentBadgeText}>{documents.length}</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.navButton, currentPanel === 'projects' && styles.navButtonActive]}
                    onPress={() => navigateToPanel('projects')}
                  >
                    <Ionicons 
                      name={currentPanel === 'projects' ? "business" : "business-outline"} 
                      size={18} 
                      color={currentPanel === 'projects' ? "#007AFF" : "#666"} 
                    />
                    <Text style={[styles.navButtonText, currentPanel === 'projects' && styles.navButtonTextActive]}>
                      Projects
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.navButton, currentPanel === 'search' && styles.navButtonActive]}
                    onPress={() => navigateToPanel('search')}
                  >
                    <Ionicons 
                      name={currentPanel === 'search' ? "search" : "search-outline"} 
                      size={18} 
                      color={currentPanel === 'search' ? "#007AFF" : "#666"} 
                    />
                    <Text style={[styles.navButtonText, currentPanel === 'search' && styles.navButtonTextActive]}>
                      Search
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.navButton, currentPanel === 'history' && styles.navButtonActive]}
                    onPress={() => navigateToPanel('history')}
                  >
                    <Ionicons 
                      name={currentPanel === 'history' ? "time" : "time-outline"} 
                      size={18} 
                      color={currentPanel === 'history' ? "#007AFF" : "#666"} 
                    />
                    <Text style={[styles.navButtonText, currentPanel === 'history' && styles.navButtonTextActive]}>
                      History
                    </Text>
                  </TouchableOpacity>
                </>
              ) : null}
              {user ? (
                <TouchableOpacity 
                  style={styles.userInfoRow}
                  onPress={() => navigateToPanel('profile')}
                >
                  <ProfilePicture user={user} />
                  <View style={styles.userNameContainer}>
                    <Text style={styles.userName}>{user.displayName || 'User'}</Text>
                    <Text style={styles.userStatus}>Signed in</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#666" />
                </TouchableOpacity>
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
          
          {/* Show different panels based on current selection */}
          {currentPanel === 'dashboard' ? (
            <DashboardScreen 
              user={user}
              conversations={conversations}
              documents={documents}
              onNavigate={navigateToPanel}
            />
          ) : showProfile ? (
            <ProfileScreen
              user={user}
              onClose={() => navigateToPanel('chat')}
            />
          ) : showHistory ? (
            <ConversationHistory 
              conversations={conversations}
              onClose={() => navigateToPanel('chat')}
              onConversationSelect={(conversation) => {
                setTranscription(conversation.transcription || '');
                setChatResponse(conversation.response);
                setCurrentConversation(conversation);
                navigateToPanel('chat');
                
                // Load conversation thread if it exists
                if (conversation.threadId) {
                  loadConversationThread(conversation.threadId);
                } else if (conversation.type === 'voice') {
                  // For voice conversations without a thread, create a single entry
                  setConversationThread([{
                    prompt: conversation.transcription || conversation.prompt,
                    response: conversation.response,
                    timestamp: conversation.timestamp,
                    id: conversation.id || Date.now().toString(),
                    type: 'voice',
                    audioUri: null // Audio URI not available from history
                  }]);
                }
              }}
              formatTimestamp={formatTimestamp}
            />
          ) : showDocuments ? (
            <DocumentManagement
              documents={documents}
              onUpload={handleDocumentUpload}
              onDelete={handleDocumentDelete}
              onClose={() => navigateToPanel('chat')}
              onRefresh={() => {
                console.log('🔄 Manual refresh triggered from DocumentManagement');
                loadUserDocuments(true);
              }}
              isUploading={isUploading}
              isRefreshing={isRefreshingDocuments}
            />
          ) : selectedProject ? (
            <ProjectDetails
              route={{ params: { project: selectedProject } }}
              navigation={{
                goBack: () => {
                  setSelectedProject(null);
                  setShowProjects(true);
                },
                navigate: (screen, params) => {
                  if (screen === 'ProjectDashboard') {
                    setSelectedProject(null);
                    setShowProjects(true);
                    setShowProjectSearch(false);
                  }
                }
              }}
            />
          ) : showProjects ? (
            <ProjectDashboard
              onClose={() => navigateToPanel('chat')}
              navigation={{
                navigate: (screen, params) => {
                  if (screen === 'ProjectDetails') {
                    setSelectedProject(params.project);
                    setShowProjects(false);
                  } else if (screen === 'ProjectSearch') {
                    setShowProjects(false);
                    setShowProjectSearch(true);
                  }
                },
                goBack: () => navigateToPanel('chat')
              }}
            />
          ) : showProjectSearch ? (
            <ProjectSearch
              onClose={() => navigateToPanel('chat')}
              navigation={{
                navigate: (screen, params) => {
                  if (screen === 'ProjectDetails') {
                    setSelectedProject(params.project);
                    setShowProjectSearch(false);
                  } else if (screen === 'ProjectDashboard') {
                    setShowProjectSearch(false);
                    setShowProjects(true);
                  }
                },
                goBack: () => navigateToPanel('chat')
              }}
            />
          ) : (
            <>
              <View style={styles.middleSection}>
                <ScrollView style={styles.middleScroll} contentContainerStyle={styles.middleScrollContent}>
                  {/* Clear conversation button */}
                  {(currentConversation || transcription || chatResponse || conversationThread.length > 0) ? (
                    <TouchableOpacity style={styles.clearButton} onPress={clearCurrentConversation}>
                      <Ionicons name="refresh-outline" size={18} color="#007AFF" />
                      <Text style={styles.clearButtonText}>New Conversation</Text>
                    </TouchableOpacity>
                  ) : null}
                  
                  {/* Display conversation thread messages */}
                  {conversationThread.map((message, index) => (
                    <ConversationItem
                      key={message.id || index}
                      conversation={{
                        ...message,
                        formatTimestamp: () => formatTimestamp(message.timestamp)
                      }}
                      onPress={() => {}} // No action for individual messages in thread
                      onDocumentPress={handleDocumentPress}
                    />
                  ))}
                  
                  {/* Current conversation (if not in thread yet) */}
                  {transcription && !conversationThread.find(msg => msg.prompt === transcription) ? (
                    <View style={styles.messageContainer}>
                      <View style={styles.userMessage}>
                        <Text style={styles.transcriptionText}>{transcription}</Text>
                        {recordedUri && (
                          <TouchableOpacity onPress={playRecording}>
                            <Ionicons name="play-circle" size={20} color="#fff" style={styles.messageIcon} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ) : null}
                  
                  {/* Current response loading or display */}
                  {isChatLoading ? (
                    <View style={styles.messageContainer}>
                      <View style={styles.assistantMessage}>
                        <Text style={styles.chatLoading}>PowerNOVA is thinking...</Text>
                      </View>
                    </View>
                  ) : chatResponse && !conversationThread.find(msg => msg.response === chatResponse) ? (
                    <ConversationItem
                      conversation={{
                        response: chatResponse,
                        timestamp: new Date(),
                        type: transcription ? 'voice' : 'text',
                        audioUri: transcription ? recordedUri : null,
                        sourceDocuments: currentResponseData?.sourceDocuments || currentConversation?.sourceDocuments,
                        hasReferences: currentResponseData?.hasReferences || currentConversation?.hasReferences,
                        referenceSummary: currentResponseData?.referenceSummary || currentConversation?.referenceSummary,
                        documentSources: currentResponseData?.documentSources || currentConversation?.documentSources,
                        formatTimestamp: () => formatTimestamp(new Date())
                      }}
                      onPress={() => {}} // No action for current response
                      onDocumentPress={handleDocumentPress}
                      showPlayButton={true}
                      isPlaying={isTextSpeaking(chatResponse)}
                      onPlayPress={() => isTextSpeaking(chatResponse) ? stopText(chatResponse) : playText(chatResponse)}
                    />
                  ) : null}
                  
                  {/* Welcome message for new users */}
                  {!currentConversation && !transcription && !chatResponse && conversationThread.length === 0 ? (
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
              
              {/* Floating stop speech button */}
              {isSpeaking && (
                <TouchableOpacity
                  style={styles.floatingStopButton}
                  onPress={stopSpeech}
                >
                  <Ionicons name="stop-circle" size={20} color="#fff" />
                  <Text style={styles.floatingStopText}>Stop Speech</Text>
                </TouchableOpacity>
              )}
              
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
      </MainLayout>
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
    flexWrap: 'wrap',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  navButton: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 60,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  navButtonActive: {
    backgroundColor: '#e3f2fd',
    shadowOpacity: 0.1,
  },
  navButtonText: {
    fontSize: 10,
    color: '#666',
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },
  navButtonTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  documentBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
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
  disabledButton: {
    opacity: 0.5,
  },
  stopSpeechButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  stopSpeechText: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  floatingStopButton: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF3B30',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  floatingStopText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
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

const markdownStyles = StyleSheet.create({
  body: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Roboto',
  },
  heading1: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
    marginTop: 16,
    marginBottom: 8,
  },
  heading2: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    marginTop: 12,
    marginBottom: 6,
  },
  heading3: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
    marginTop: 10,
    marginBottom: 5,
  },
  paragraph: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    marginTop: 0,
    marginBottom: 8,
  },
  strong: {
    fontWeight: 'bold',
    color: '#333',
  },
  em: {
    fontStyle: 'italic',
    color: '#333',
  },
  code_inline: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#d73a49',
  },
  code_block: {
    backgroundColor: '#f6f8fa',
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#e1e4e8',
  },
  list_item: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    marginBottom: 4,
  },
  bullet_list: {
    marginTop: 4,
    marginBottom: 8,
  },
  ordered_list: {
    marginTop: 4,
    marginBottom: 8,
  },
  link: {
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  blockquote: {
    backgroundColor: '#f8f9fa',
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
    paddingLeft: 12,
    paddingVertical: 8,
    marginVertical: 8,
    fontStyle: 'italic',
  },
  table: {
    borderWidth: 1,
    borderColor: '#e1e4e8',
    borderRadius: 6,
    marginVertical: 8,
  },
  thead: {
    backgroundColor: '#f6f8fa',
  },
  tbody: {
    backgroundColor: '#fff',
  },
  th: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    padding: 8,
    borderWidth: 1,
    borderColor: '#e1e4e8',
  },
  td: {
    fontSize: 14,
    color: '#333',
    padding: 8,
    borderWidth: 1,
    borderColor: '#e1e4e8',
  },
});

// Handle document reference clicks
const handleDocumentPress = async (documentId, page) => {
  try {
    // Try to import the full document viewer service, fallback to simple version
    let DocumentViewerService;
    try {
      DocumentViewerService = require('./services/documentViewerService').default;
    } catch (error) {
      console.warn('Using simple document viewer service as fallback');
      DocumentViewerService = require('./services/simpleDocumentViewerService').default;
    }
    
    await DocumentViewerService.handleDocumentPress(documentId, page);
  } catch (error) {
    console.error('Error opening document:', error);
    Alert.alert('Error', `Unable to open document: ${error.message}`);
  }
};
