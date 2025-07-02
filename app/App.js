import React, { useState, useRef } from 'react';
import { Button, StyleSheet, Text, View, TouchableOpacity, ScrollView, SafeAreaView, TextInput, Platform } from 'react-native';
import { Audio } from 'expo-av';
import { StatusBar } from 'expo-status-bar';
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';

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

  // Use API key from env for EAS builds, or from app.json extra for local dev
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY || (Constants.expoConfig?.extra?.openaiApiKey ?? '');
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.outerContainer}>
        <Text style={styles.heading}>{MAIN_HEADING}</Text>
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
});
