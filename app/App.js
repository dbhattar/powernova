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

// Document Upload Component
const DocumentUpload = ({ onUpload, isUploading }) => {
  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      onUpload(file);
    }
  };

  return (
    <View style={styles.documentUploadContainer}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
      <TouchableOpacity
        style={[styles.uploadButton, isUploading && styles.uploadButtonDisabled]}
        onPress={() => fileInputRef.current?.click()}
        disabled={isUploading}
      >
        <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
        <Text style={styles.uploadButtonText}>
          {isUploading ? 'Uploading...' : 'Upload Document'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// Document List Item Component
const DocumentItem = ({ document, onDelete, onSelect }) => {
  const formatDate = (date) => {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <TouchableOpacity style={styles.documentItem} onPress={() => onSelect(document)}>
      <View style={styles.documentItemHeader}>
        <Ionicons name={getFileIcon(document.fileType)} size={24} color="#007AFF" />
        <View style={styles.documentItemInfo}>
          <Text style={styles.documentItemName} numberOfLines={1}>
            {document.fileName}
          </Text>
          <Text style={styles.documentItemMeta}>
            {formatFileSize(document.fileSize)} • {formatDate(document.uploadedAt)}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => onDelete(document)}
        >
          <Ionicons name="trash-outline" size={18} color="#FF3B30" />
        </TouchableOpacity>
      </View>
      <View style={styles.documentItemStatus}>
        {document.isProcessed ? (
          <View style={styles.statusBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#28a745" />
            <Text style={styles.statusText}>Ready for Q&A</Text>
          </View>
        ) : document.processingError ? (
          <View style={[styles.statusBadge, styles.statusError]}>
            <Ionicons name="alert-circle" size={16} color="#FF3B30" />
            <Text style={[styles.statusText, styles.statusErrorText]}>Processing Error</Text>
          </View>
        ) : (
          <View style={[styles.statusBadge, styles.statusProcessing]}>
            <Ionicons name="hourglass-outline" size={16} color="#FF9500" />
            <Text style={[styles.statusText, styles.statusProcessingText]}>Processing...</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

// Document Management Component
const DocumentManagement = ({ documents, onUpload, onDelete, onClose, isUploading }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredDocuments = documents.filter(doc =>
    doc.fileName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderDocumentItem = ({ item }) => (
    <DocumentItem
      document={item}
      onDelete={onDelete}
      onSelect={(doc) => console.log('Selected document:', doc)}
    />
  );

  return (
    <View style={styles.documentManagementContainer}>
      <View style={styles.documentHeader}>
        <Text style={styles.documentTitle}>Document Library</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <DocumentUpload onUpload={onUpload} isUploading={isUploading} />

      {/* Debug: Storage permission test button */}
      <View style={styles.debugContainer}>
        <TouchableOpacity
          style={styles.testButton}
          onPress={() => testStoragePermissions()}
        >
          <Ionicons name="shield-checkmark-outline" size={16} color="#FF9500" />
          <Text style={styles.testButtonText}>Test Storage Permissions</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.testButton, { marginTop: 8 }]}
          onPress={() => checkDocumentsInFirestore()}
        >
          <Ionicons name="documents-outline" size={16} color="#007AFF" />
          <Text style={[styles.testButtonText, { color: '#007AFF' }]}>Check Documents in DB</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.testButton, { marginTop: 8 }]}
          onPress={() => testConversations()}
        >
          <Ionicons name="chatbubbles-outline" size={16} color="#28a745" />
          <Text style={[styles.testButtonText, { color: '#28a745' }]}>Check Conversations</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.testButton, { marginTop: 8 }]}
          onPress={() => testSaveConversation()}
        >
          <Ionicons name="add-circle-outline" size={16} color="#DC3545" />
          <Text style={[styles.testButtonText, { color: '#DC3545' }]}>Test Save Conversation</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search documents..."
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
      </View>

      {filteredDocuments.length === 0 ? (
        <View style={styles.emptyDocumentsContainer}>
          <Ionicons name="document-outline" size={48} color="#ccc" />
          <Text style={styles.emptyDocumentsText}>
            {documents.length === 0 ? 'No documents uploaded yet' : 'No documents match your search'}
          </Text>
          <Text style={styles.emptyDocumentsSubtext}>
            Upload PDF, DOC, DOCX, or TXT files to get started
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredDocuments}
          renderItem={renderDocumentItem}
          keyExtractor={(item) => item.id}
          style={styles.documentList}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

// ProfilePicture component for displaying user's profile picture with fallback
const ProfilePicture = ({ user }) => {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const getInitials = (name) => {
    if (!name) return 'U';
    const names = name.split(' ');
    return names.map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  const handleImageError = () => {
    setImageError(true);
    setIsLoading(false);
  };

  if (!user?.photoURL || imageError) {
    return (
      <View style={styles.profilePicFallback}>
        <Text style={styles.profilePicInitials}>
          {getInitials(user?.displayName)}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.profilePicContainer}>
      <Image
        source={{ uri: user.photoURL }}
        style={[styles.profilePic, isLoading && styles.profilePicLoading]}
        onLoad={handleImageLoad}
        onError={handleImageError}
      />
      {isLoading && (
        <View style={styles.profilePicLoader}>
          <Text style={styles.profilePicInitials}>
            {getInitials(user?.displayName)}
          </Text>
        </View>
      )}
    </View>
  );
};

// Conversation History Item Component
const ConversationItem = ({ conversation, onPress }) => {
  return (
    <TouchableOpacity style={styles.conversationItem} onPress={onPress}>
      <View style={styles.conversationHeader}>
        <View style={styles.conversationTypeContainer}>
          <Ionicons 
            name={conversation.type === 'voice' ? 'mic' : 'chatbox-ellipses'} 
            size={14} 
            color="#007AFF" 
          />
          {conversation.isFollowUp && (
            <Ionicons 
              name="arrow-forward" 
              size={12} 
              color="#FF6B35" 
              style={styles.followUpIcon}
            />
          )}
          <Text style={styles.conversationTimestamp}>
            {conversation.formatTimestamp ? conversation.formatTimestamp() : 'Recent'}
          </Text>
        </View>
      </View>
      <Text style={styles.conversationPrompt} numberOfLines={2}>
        {conversation.isFollowUp ? '↳ ' : ''}{conversation.prompt}
      </Text>
      <Text style={styles.conversationResponse} numberOfLines={2}>
        {conversation.response}
      </Text>
    </TouchableOpacity>
  );
};

// Conversation History Component
const ConversationHistory = ({ conversations, onClose, onConversationSelect, formatTimestamp }) => {
  const renderConversationItem = ({ item }) => (
    <ConversationItem 
      conversation={{
        ...item,
        formatTimestamp: () => formatTimestamp(item.timestamp)
      }}
      onPress={() => onConversationSelect(item)}
    />
  );

  return (
    <View style={styles.historyContainer}>
      <View style={styles.historyHeader}>
        <Text style={styles.historyTitle}>Conversation History</Text>
        <TouchableOpacity onPress={onClose} style={styles.historyCloseButton}>
          <Ionicons name="close" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>
      {conversations.length === 0 ? (
        <View style={styles.emptyHistoryContainer}>
          <Ionicons name="chatbox-outline" size={48} color="#ccc" />
          <Text style={styles.emptyHistoryText}>No conversations yet</Text>
          <Text style={styles.emptyHistorySubtext}>Start a conversation to see your history</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversationItem}
          keyExtractor={(item) => item.id}
          style={styles.conversationList}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

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

  // Use API key from env for EAS builds, or from app.json extra for local dev
  // Robustly fetch OpenAI API key for all platforms (EAS env, app.json extra, web manifest, process.env)
  function getOpenAIApiKey() {
    // Expo Go and native: Constants.expoConfig.extra
    if (typeof Constants?.expoConfig?.extra?.openaiApiKey === 'string') {
      console.log("Using OpenAI API key from Constants.expoConfig.extra");
      return Constants.expoConfig.extra.openaiApiKey;
    }
    // Expo web (dev): Constants.manifest.extra
    if (typeof Constants?.manifest?.extra?.openaiApiKey === 'string') {
      console.log("Using OpenAI API key from Constants.manifest.extra");
      return Constants.manifest.extra.openaiApiKey;
    }
    // EAS env (native): process.env
    if (typeof process !== 'undefined' && process.env && process.env.OPENAI_API_KEY) {
      console.log("Using OpenAI API key from process.env");
      return process.env.OPENAI_API_KEY;
    }
    // Fallback: window.__APP_CONFIG__ (for custom web injection)
    if (typeof window !== 'undefined' && window.__APP_CONFIG__?.openaiApiKey) {
      console.log("Using OpenAI API key from window.__APP_CONFIG__");
      return window.__APP_CONFIG__.openaiApiKey;
    }
    return '';
  }

  const OPENAI_API_KEY = getOpenAIApiKey();

  if (!OPENAI_API_KEY) {
    console.warn('OpenAI API key is not set. Please configure it in app.json extra, EAS env, or your web config.');
  }

  const MAIN_HEADING = Constants.expoConfig.extra.mainHeading;

  // System prompt for PowerNOVA
  const SYSTEM_PROMPT = "You are PowerNOVA, an expert assistant specialized in power systems, electrical engineering, and related topics such as power generation, transmission, distribution, grid operations, renewable energy, and power system analysis. If a user asks a question outside of these areas, politely respond: 'I'm here to help with power systems and related topics. Please ask a question about electrical power systems, engineering, or energy!'";

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

  // Send transcription to OpenAI Chat API with document context and conversation history
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
      // Get document context if available
      let documentContext = '';
      if (documentService && documents.length > 0) {
        const relevantDocs = documentService.getDocumentContext(documents, text);
        if (relevantDocs.length > 0) {
          documentContext = '\n\nRelevant documents:\n' + 
            relevantDocs.map(doc => `File: ${doc.fileName}\nContent: ${doc.content}`).join('\n\n');
        }
      }

      // Build conversation history for context
      const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
      
      // Add previous conversation context if this is a follow-up
      if (isFollowUp && conversationThread.length > 0) {
        conversationThread.forEach(msg => {
          messages.push({ role: 'user', content: msg.prompt });
          messages.push({ role: 'assistant', content: msg.response });
        });
      }
      
      // Add current user message
      messages.push({ role: 'user', content: text + documentContext });

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: messages,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API error:', errorText);
        throw new Error('Chat failed');
      }

      const data = await response.json();
      const responseText = data.choices?.[0]?.message?.content || 'No response.';
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
      
      // Save to Firestore if user is signed in
      if (user) {
        await saveToFirestore(recordedUri, transcription, text, responseText, currentThreadId, isFollowUp);
      }
      
    } catch (err) {
      const errorMessage = 'Chat failed.';
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

  // Modified transcription to auto-send to chat
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
      const formData = new FormData();
      formData.append('file', {
        uri: fileUri,
        name: getFileName(fileUri),
        type: 'audio/mp4', // Use audio/mp4 for m4a files
      });
      formData.append('model', 'whisper-1');
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'multipart/form-data',
          'Accept': 'application/json',
        },
        body: formData,
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API error:', errorText);
        throw new Error('Transcription failed');
      }
      const data = await response.json();
      setTranscription(data.text || 'No transcription found.');
      if (data.text) {
        await sendToChat(data.text);
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

  // Save chat/audio to Firestore if signed in
  const saveToFirestore = async (audioUri, transcription, prompt, response, threadId, isFollowUp = false) => {
    if (!user) {
      console.log('No user signed in, skipping Firestore save');
      return;
    }
    try {
      console.log('Attempting to save to Firestore for user:', user.uid);
      console.log('Conversation data:', {
        uid: user.uid,
        threadId: threadId,
        prompt: prompt.substring(0, 100) + '...',
        response: response.substring(0, 100) + '...',
        type: transcription ? 'voice' : 'text',
        isFollowUp: isFollowUp,
      });
      
      const docRef = await addDoc(collection(db, 'conversations'), {
        uid: user.uid,
        threadId: threadId,
        audioUri: audioUri || null,
        transcription: transcription || null,
        prompt,
        response,
        type: transcription ? 'voice' : 'text',
        isFollowUp: isFollowUp,
        createdAt: serverTimestamp(),
      });
      console.log('✅ Conversation saved to Firestore successfully:', docRef.id);
    } catch (e) {
      console.error('❌ Error saving to Firestore:', e);
      console.error('Error code:', e.code);
      console.error('Error message:', e.message);
      
      if (e.code === 'permission-denied') {
        console.error('🔒 Firestore permission denied for conversations collection');
        console.error('Check your Firestore security rules for the conversations collection');
      }
      // Continue without blocking the UI
    }
  };

  // Load conversation history from Firestore
  const loadConversationHistory = (userId) => {
    if (!userId) {
      console.log('No user ID provided, clearing conversations');
      setConversations([]);
      return;
    }

    try {
      console.log('Loading conversation history for user:', userId);
      // Use simple query without orderBy to avoid index requirement initially
      const q = query(
        collection(db, 'conversations'),
        where('uid', '==', userId)
      );

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        console.log('📞 Received conversation snapshot, size:', querySnapshot.size);
        const loadedConversations = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          console.log('📄 Conversation doc:', {
            id: doc.id,
            prompt: data.prompt?.substring(0, 50) + '...',
            threadId: data.threadId,
            type: data.type,
            isFollowUp: data.isFollowUp,
            createdAt: data.createdAt
          });
          loadedConversations.push({
            id: doc.id,
            ...data,
            timestamp: data.createdAt?.toDate() || new Date(),
          });
        });
        
        // Sort conversations manually by creation date (descending)
        loadedConversations.sort((a, b) => b.timestamp - a.timestamp);
        
        console.log('📋 Loaded conversations for state:', loadedConversations.length);
        setConversations(loadedConversations);
      }, (error) => {
        console.error('❌ Error loading conversations:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        if (error.code === 'permission-denied') {
          console.error('🔒 Firestore permission denied for conversations collection');
          console.error('Check your Firestore security rules for the conversations collection');
          console.error('See FIRESTORE_SETUP.md for instructions.');
        } else if (error.code === 'failed-precondition') {
          console.error('📊 Missing Firestore index for conversations query');
          console.error('Go to Firebase console and create the required index');
        }
        
        // Set empty array on error to prevent infinite loading
        setConversations([]);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error setting up conversation listener:', error);
      setConversations([]);
    }
  };

  // Load conversation thread from Firestore
  const loadConversationThread = async (threadId) => {
    if (!user || !threadId) return;
    
    try {
      console.log('Loading conversation thread:', threadId);
      // Use simple query without orderBy to avoid index requirement
      const q = query(
        collection(db, 'conversations'),
        where('uid', '==', user.uid),
        where('threadId', '==', threadId)
      );

      const querySnapshot = await getDocs(q);
      const threadMessages = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        threadMessages.push({
          id: doc.id,
          prompt: data.prompt,
          response: data.response,
          timestamp: data.createdAt?.toDate() || new Date(),
        });
      });
      
      // Sort manually by creation date (ascending for thread)
      threadMessages.sort((a, b) => a.timestamp - b.timestamp);
      
      setConversationThread(threadMessages);
      setThreadId(threadId);
      console.log('Loaded thread messages:', threadMessages.length);
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

  // Call saveToFirestore after chat response
  React.useEffect(() => {
    if (user && chatResponse && (transcription || inputText)) {
      // Don't save again if already saved in sendToChat
      // This effect is kept for backward compatibility
    }
    // eslint-disable-next-line
  }, [chatResponse]);

  // Load conversation history when user signs in/out
  React.useEffect(() => {
    let unsubscribe;
    console.log('User state changed:', user?.uid || 'signed out');
    
    if (user) {
      try {
        unsubscribe = loadConversationHistory(user.uid);
      } catch (error) {
        console.error('Failed to load conversation history:', error);
        setConversations([]);
      }
    } else {
      setConversations([]);
    }
    
    return () => {
      if (unsubscribe) {
        console.log('Cleaning up conversation listener');
        unsubscribe();
      }
    };
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
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    marginRight: 12,
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
  // History styles
  historyContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
  },
  historyCloseButton: {
    backgroundColor: '#f0f0f0',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conversationList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  conversationItem: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    marginVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  conversationTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  followUpIcon: {
    marginLeft: 2,
  },
  conversationTimestamp: {
    fontSize: 12,
    color: '#666',
  },
  conversationPrompt: {
    fontSize: 14,
    color: '#222',
    fontWeight: '500',
    marginBottom: 4,
  },
  conversationResponse: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  emptyHistoryContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyHistoryText: {
    fontSize: 18,
    color: '#666',
    fontWeight: '500',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyHistorySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  
  // Document management styles
  documentManagementContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  documentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  documentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
  },
  closeButton: {
    backgroundColor: '#f0f0f0',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentUploadContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  uploadButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  uploadButtonDisabled: {
    backgroundColor: '#ccc',
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  debugContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    alignItems: 'center',
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FF9500',
  },
  testButtonText: {
    color: '#856404',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchIcon: {
    position: 'absolute',
    left: 28,
    zIndex: 1,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingLeft: 48,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  documentList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  documentItem: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    marginVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  documentItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  documentItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  documentItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#222',
    marginBottom: 4,
  },
  documentItemMeta: {
    fontSize: 12,
    color: '#666',
  },
  deleteButton: {
    backgroundColor: '#ffebee',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentItemStatus: {
    marginTop: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusProcessing: {
    backgroundColor: '#fff3cd',
  },
  statusError: {
    backgroundColor: '#f8d7da',
  },
  statusText: {
    fontSize: 12,
    color: '#28a745',
    fontWeight: '500',
  },
  statusProcessingText: {
    color: '#856404',
  },
  statusErrorText: {
    color: '#721c24',
  },
  emptyDocumentsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyDocumentsText: {
    fontSize: 18,
    color: '#666',
    fontWeight: '500',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyDocumentsSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
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
  // Profile picture styles
  profilePicContainer: {
    position: 'relative',
    width: 35,
    height: 35,
    borderRadius: 17.5,
    overflow: 'hidden',
  },
  profilePic: {
    width: '100%',
    height: '100%',
    borderRadius: 17.5,
  },
  profilePicLoading: {
    opacity: 0.5,
  },
  profilePicLoader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 17.5,
  },
  profilePicFallback: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePicInitials: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
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
  // Document management styles
  documentManagementContainer: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  documentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  documentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
  },
  closeButton: {
    backgroundColor: '#f0f0f0',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentUploadContainer: {
    marginBottom: 16,
    alignItems: 'center',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
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
  },
  uploadButtonDisabled: {
    backgroundColor: '#ccc',
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  emptyDocumentsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyDocumentsText: {
    fontSize: 18,
    color: '#666',
    fontWeight: '500',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyDocumentsSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  documentList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  documentItem: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    marginVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  documentItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  documentItemInfo: {
    flex: 1,
    marginLeft: 8,
  },
  documentItemName: {
    fontSize: 14,
    color: '#222',
    fontWeight: '500',
    marginBottom: 4,
  },
  documentItemMeta: {
    fontSize: 12,
    color: '#666',
  },
  deleteButton: {
    backgroundColor: '#f0f0f0',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentItemStatus: {
    marginTop: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f7fa',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#007AFF',
    marginLeft: 4,
  },
  statusError: {
    backgroundColor: '#f8d7da',
  },
  statusErrorText: {
    color: '#c82333',
  },
  statusProcessing: {
    backgroundColor: '#fff3cd',
  },
  statusProcessingText: {
    color: '#856404',
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
