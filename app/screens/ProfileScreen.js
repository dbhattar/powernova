import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
  BackHandler,
  Modal,
  StatusBar,
  SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../firebase';
import { ProfilePicture } from '../components';

const ProfileScreen = ({ onClose, user }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [settings, setSettings] = useState(null);
  const [displayName, setDisplayName] = useState('');

  // Ensure onClose is always available
  const handleClose = () => {
    if (onClose && typeof onClose === 'function') {
      onClose();
    } else {
      console.warn('ProfileScreen: onClose prop is not available');
    }
  };

  // Backend API configuration
  const BACKEND_API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3002/api';

  // Handle hardware back button on Android
  useEffect(() => {
    const backAction = () => {
      handleClose();
      return true; // Prevent default behavior
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);

  const loadUserProfile = async () => {
    try {
      setIsLoading(true);
      const token = await user.getIdToken();
      
      const response = await fetch(`${BACKEND_API_URL}/user/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Profile not found. The user profile may not be set up yet.');
        } else if (response.status === 401) {
          throw new Error('Authentication failed. Please sign in again.');
        } else if (response.status >= 500) {
          throw new Error('Server error. Please try again later.');
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }

      const data = await response.json();
      setProfile(data.user);
      setSettings(data.settings);
      setDisplayName(data.user.display_name || '');
    } catch (error) {
      console.error('Error loading user profile:', error);
      Alert.alert('Error', error.message || 'Failed to load user profile');
    } finally {
      setIsLoading(false);
    }
  };

  const updateSettings = async (newSettings) => {
    try {
      const token = await user.getIdToken();
      
      const response = await fetch(`${BACKEND_API_URL}/user/settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSettings),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setSettings(data.settings);
      return true;
    } catch (error) {
      console.error('Error updating settings:', error);
      Alert.alert('Error', 'Failed to update settings');
      return false;
    }
  };

  const updateProfile = async () => {
    try {
      setIsSaving(true);
      const token = await user.getIdToken();
      
      const response = await fetch(`${BACKEND_API_URL}/user/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          display_name: displayName,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setProfile(data.user);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSettingChange = async (key, value) => {
    const newSettings = { [key]: value };
    const success = await updateSettings(newSettings);
    if (!success) {
      // Revert the change if it failed
      loadUserProfile();
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await user.getIdToken();
              
              const response = await fetch(`${BACKEND_API_URL}/user/account`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
              });

              if (response.ok) {
                Alert.alert('Account Deleted', 'Your account has been deleted successfully');
                // Sign out the user
                auth.signOut();
                handleClose();
              } else {
                throw new Error('Failed to delete account');
              }
            } catch (error) {
              console.error('Error deleting account:', error);
              Alert.alert('Error', 'Failed to delete account');
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <Modal
        animationType="slide"
        transparent={false}
        visible={true}
        onRequestClose={handleClose}
        statusBarTranslucent={Platform.OS === 'android'}
      >
        <SafeAreaView style={styles.container}>
          {/* Header - Always visible */}
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={handleClose} 
              style={styles.closeButton}
              activeOpacity={0.7}
              testID="profile-close-button"
            >
              <Ionicons name="close" size={28} color="#007AFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Profile & Settings</Text>
            <TouchableOpacity 
              onPress={handleClose} 
              style={styles.doneButton}
              activeOpacity={0.7}
              testID="profile-done-button"
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
          
          {/* Loading Content */}
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading profile...</Text>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  if (!profile || !settings) {
    return (
      <Modal
        animationType="slide"
        transparent={false}
        visible={true}
        onRequestClose={handleClose}
        statusBarTranslucent={Platform.OS === 'android'}
      >
        <SafeAreaView style={styles.container}>
          {/* Header - Always visible */}
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={handleClose} 
              style={styles.closeButton}
              activeOpacity={0.7}
              testID="profile-close-button"
            >
              <Ionicons name="close" size={28} color="#007AFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Profile & Settings</Text>
            <TouchableOpacity 
              onPress={handleClose} 
              style={styles.doneButton}
              activeOpacity={0.7}
              testID="profile-done-button"
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
          
          {/* Error Content */}
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={64} color="#FF3B30" />
            <Text style={styles.errorTitle}>Connection Error</Text>
            <Text style={styles.errorText}>
              Unable to load your profile. Please check your internet connection and try again.
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadUserProfile}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeFromErrorButton} onPress={handleClose}>
              <Text style={styles.closeFromErrorButtonText}>Close</Text>
            </TouchableOpacity>
            
            {/* Sign Out Button - Always available even when profile fails to load */}
            <View style={styles.errorSignOutContainer}>
              <Text style={styles.errorSignOutLabel}>Account Actions</Text>
              <TouchableOpacity 
                style={styles.errorSignOutButton}
                onPress={() => {
                  auth.signOut();
                  handleClose();
                }}
              >
                <Ionicons name="log-out-outline" size={20} color="#007AFF" />
                <Text style={styles.errorSignOutButtonText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={true}
      onRequestClose={handleClose}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={handleClose} 
            style={styles.closeButton}
            activeOpacity={0.7}
            testID="profile-close-button"
          >
            <Ionicons name="close" size={28} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile & Settings</Text>
          <TouchableOpacity 
            onPress={handleClose} 
            style={styles.doneButton}
            activeOpacity={0.7}
            testID="profile-done-button"
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <View style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <ProfilePicture user={user} />
              <View style={styles.profileInfo}>
                <Text style={styles.emailText}>{profile.email}</Text>
                <Text style={styles.memberSinceText}>
                  Member since {new Date(profile.created_at).toLocaleDateString()}
                </Text>
              </View>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Display Name</Text>
              <TextInput
                style={styles.textInput}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Enter your display name"
                maxLength={50}
              />
            </View>
            
            <TouchableOpacity 
              style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} 
              onPress={updateProfile}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>Save Profile</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.settingsCard}>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Email Notifications</Text>
                <Text style={styles.settingDescription}>Receive updates via email</Text>
              </View>
              <Switch
                value={settings.email_notifications}
                onValueChange={(value) => handleSettingChange('email_notifications', value)}
                trackColor={{ false: '#E5E5E7', true: '#007AFF' }}
                thumbColor={Platform.OS === 'android' ? '#fff' : ''}
              />
            </View>
            
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Push Notifications</Text>
                <Text style={styles.settingDescription}>Receive push notifications</Text>
              </View>
              <Switch
                value={settings.push_notifications}
                onValueChange={(value) => handleSettingChange('push_notifications', value)}
                trackColor={{ false: '#E5E5E7', true: '#007AFF' }}
                thumbColor={Platform.OS === 'android' ? '#fff' : ''}
              />
            </View>
            
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Marketing Emails</Text>
                <Text style={styles.settingDescription}>Receive promotional content</Text>
              </View>
              <Switch
                value={settings.marketing_emails}
                onValueChange={(value) => handleSettingChange('marketing_emails', value)}
                trackColor={{ false: '#E5E5E7', true: '#007AFF' }}
                thumbColor={Platform.OS === 'android' ? '#fff' : ''}
              />
            </View>
          </View>
        </View>

        {/* App Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Preferences</Text>
          <View style={styles.settingsCard}>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Theme</Text>
                <Text style={styles.settingDescription}>Choose your preferred theme</Text>
              </View>
              <View style={styles.themeSelector}>
                {['light', 'dark', 'auto'].map((theme) => (
                  <TouchableOpacity
                    key={theme}
                    style={[
                      styles.themeOption,
                      settings.theme === theme && styles.themeOptionSelected
                    ]}
                    onPress={() => handleSettingChange('theme', theme)}
                  >
                    <Text style={[
                      styles.themeOptionText,
                      settings.theme === theme && styles.themeOptionTextSelected
                    ]}>
                      {theme.charAt(0).toUpperCase() + theme.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Auto-play Voice Responses</Text>
                <Text style={styles.settingDescription}>Automatically play voice responses</Text>
              </View>
              <Switch
                value={settings.auto_play_voice}
                onValueChange={(value) => handleSettingChange('auto_play_voice', value)}
                trackColor={{ false: '#E5E5E7', true: '#007AFF' }}
                thumbColor={Platform.OS === 'android' ? '#fff' : ''}
              />
            </View>
            
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Voice Speed</Text>
                <Text style={styles.settingDescription}>
                  Current: {settings.voice_speed}x
                </Text>
              </View>
              <View style={styles.speedSelector}>
                {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((speed) => (
                  <TouchableOpacity
                    key={speed}
                    style={[
                      styles.speedOption,
                      settings.voice_speed === speed && styles.speedOptionSelected
                    ]}
                    onPress={() => handleSettingChange('voice_speed', speed)}
                  >
                    <Text style={[
                      styles.speedOptionText,
                      settings.voice_speed === speed && styles.speedOptionTextSelected
                    ]}>
                      {speed}x
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Privacy Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy</Text>
          <View style={styles.settingsCard}>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Analytics</Text>
                <Text style={styles.settingDescription}>Help improve the app with usage data</Text>
              </View>
              <Switch
                value={settings.analytics_enabled}
                onValueChange={(value) => handleSettingChange('analytics_enabled', value)}
                trackColor={{ false: '#E5E5E7', true: '#007AFF' }}
                thumbColor={Platform.OS === 'android' ? '#fff' : ''}
              />
            </View>
            
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Crash Reporting</Text>
                <Text style={styles.settingDescription}>Send crash reports to help fix bugs</Text>
              </View>
              <Switch
                value={settings.crash_reporting}
                onValueChange={(value) => handleSettingChange('crash_reporting', value)}
                trackColor={{ false: '#E5E5E7', true: '#007AFF' }}
                thumbColor={Platform.OS === 'android' ? '#fff' : ''}
              />
            </View>
          </View>
        </View>

        {/* Account Actions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.settingsCard}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => {
                auth.signOut();
                handleClose();
              }}
            >
              <Ionicons name="log-out-outline" size={20} color="#007AFF" />
              <Text style={styles.actionButtonText}>Sign Out</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.dangerButton]}
              onPress={handleDeleteAccount}
            >
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              <Text style={[styles.actionButtonText, styles.dangerButtonText]}>Delete Account</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Additional Close Button at Bottom */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.bottomCloseButton}
            onPress={handleClose}
            activeOpacity={0.7}
            testID="profile-bottom-close-button"
          >
            <Ionicons name="chevron-down" size={24} color="#007AFF" />
            <Text style={styles.bottomCloseButtonText}>Close Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e4e8',
  },
  closeButton: {
    padding: 8,
    borderRadius: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButton: {
    padding: 8,
    borderRadius: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  scrollContainer: {
    flex: 1,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileInfo: {
    marginLeft: 12,
    flex: 1,
  },
  emailText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  memberSinceText: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e1e4e8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  settingsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  themeSelector: {
    flexDirection: 'row',
    marginTop: 8,
  },
  themeOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f1f3f4',
    marginRight: 8,
  },
  themeOptionSelected: {
    backgroundColor: '#007AFF',
  },
  themeOptionText: {
    fontSize: 14,
    color: '#666',
  },
  themeOptionTextSelected: {
    color: '#fff',
  },
  speedSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  speedOption: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f1f3f4',
    marginRight: 6,
    marginBottom: 6,
  },
  speedOptionSelected: {
    backgroundColor: '#007AFF',
  },
  speedOptionText: {
    fontSize: 12,
    color: '#666',
  },
  speedOptionTextSelected: {
    color: '#fff',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
  },
  actionButtonText: {
    fontSize: 16,
    color: '#007AFF',
    marginLeft: 12,
  },
  dangerButton: {
    borderBottomWidth: 0,
  },
  dangerButtonText: {
    color: '#FF3B30',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginBottom: 16,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  closeFromErrorButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e1e4e8',
  },
  closeFromErrorButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorSignOutContainer: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#e1e4e8',
    width: '100%',
    alignItems: 'center',
  },
  errorSignOutLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorSignOutButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e1e4e8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorSignOutButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  bottomCloseButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e1e4e8',
  },
  bottomCloseButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  bottomSpacing: {
    height: 32,
  },
});

export default ProfileScreen;
