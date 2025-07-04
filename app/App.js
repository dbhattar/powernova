import React, { useState, useRef } from 'react';
import { Button, StyleSheet, Text, View, TouchableOpacity, ScrollView, SafeAreaView, TextInput, Platform, Image } from 'react-native';
import { Audio } from 'expo-av';
import { StatusBar } from 'expo-status-bar';
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, updateProfile } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

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
      confirm.log("Using OpenAI API key from Constants.manifest.extra");
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

  // Send transcription to OpenAI Chat API
  const sendToChat = async (text) => {
    setIsChatLoading(true);
    setChatResponse('');
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: text },
          ],
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API error:', errorText);
        throw new Error('Chat failed');
      }
      const data = await response.json();
      setChatResponse(data.choices?.[0]?.message?.content || 'No response.');
    } catch (err) {
      setChatResponse('Chat failed.');
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
        sendToChat(inputText.trim());
        setTranscription('');
        setInputText('');
      }
      // Prevent default newline
      e.preventDefault && e.preventDefault();
    } else if ((e.nativeEvent.key === 'Enter' && (e.nativeEvent.ctrlKey || e.nativeEvent.shiftKey))) {
      // Allow multi-line input with Ctrl+Enter or Shift+Enter
      setInputText(inputText + '\n');
    }
  };

  // Save chat/audio to Firestore if signed in
  const saveToFirestore = async (audioUri, transcription, prompt, response) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'conversations'), {
        uid: user.uid,
        audioUri,
        transcription,
        prompt,
        response,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.error('Error saving to Firestore:', e);
    }
  };

  // Call saveToFirestore after chat response
  React.useEffect(() => {
    if (user && chatResponse && (transcription || inputText)) {
      saveToFirestore(recordedUri, transcription, transcription || inputText, chatResponse);
    }
    // eslint-disable-next-line
  }, [chatResponse]);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return unsubscribe;
  }, []);

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

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('Auth state changed:', user);
      setUser(user);
    });
    return unsubscribe;
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.outerContainer}>
        <View style={styles.headerRow}>
          <Text style={styles.heading}>{MAIN_HEADING}</Text>
          {user ? (
            <View style={styles.userInfoRow}>
              <ProfilePicture user={user} />
              <View style={styles.userNameContainer}>
                <Text style={styles.userName}>{user.displayName || 'User'}</Text>
                <Text style={styles.userStatus}>Signed in</Text>
              </View>
              <TouchableOpacity
                style={styles.signOutButton}
                onPress={() => signOut(auth)}
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
        <View style={styles.middleSection}>
          <ScrollView style={styles.middleScroll} contentContainerStyle={styles.middleScrollContent}>
            {transcription ? (
              <Text style={styles.transcriptionText}>{transcription}</Text>
            ) : null}
            {isChatLoading ? (
              <Text style={styles.chatLoading}>Loading chat response...</Text>
            ) : chatResponse ? (
              <Text style={styles.chatResponse}>{chatResponse}</Text>
            ) : null}
          </ScrollView>
        </View>
        <View style={styles.inputSection}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={handleInputChange}
            placeholder="Type a message..."
            editable={!isRecording && !isMicActive}
            multiline
            blurOnSubmit={false}
            onKeyPress={handleTextInputKeyPress}
            // Optionally, autoFocus for better UX
          />
          <TouchableOpacity
            style={[styles.micButton, isMicActive && styles.micActive]}
            onPress={handleMicPress}
            disabled={isTranscribing || isChatLoading}
          >
            <Ionicons name={isMicActive ? 'mic-off' : 'mic'} size={28} color="#fff" />
          </TouchableOpacity>
        </View>
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
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
    color: '#222',
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
  recordButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginBottom: 10,
  },
  transcribeButton: {
    backgroundColor: '#34C759',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 10,
  },
  newRecordingButton: {
    backgroundColor: '#FF9500',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 10,
  },
  speakButton: {
    backgroundColor: '#5856D6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  transcriptionText: {
    marginTop: 16,
    color: '#333',
    fontStyle: 'italic',
    fontSize: 16,
    textAlign: 'center',
  },
  chatResponse: {
    marginTop: 16,
    color: '#222',
    fontSize: 18,
    textAlign: 'center',
  },
  chatLoading: {
    marginTop: 16,
    color: '#007AFF',
    fontSize: 16,
    textAlign: 'center',
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
  profilePicLoader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
});
