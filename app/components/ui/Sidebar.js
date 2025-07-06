import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const Sidebar = ({ navigation, user, currentRoute, onClose, onNavigate }) => {
  const menuItems = [
    { 
      title: 'Dashboard', 
      icon: 'home-outline', 
      activeIcon: 'home',
      route: 'Dashboard',
      description: 'Main overview',
      panel: 'dashboard'
    },
    { 
      title: 'Chat', 
      icon: 'chatbubble-outline', 
      activeIcon: 'chatbubble',
      route: 'Chat',
      description: 'AI Assistant',
      panel: 'chat'
    },
    { 
      title: 'Documents', 
      icon: 'document-text-outline', 
      activeIcon: 'document-text',
      route: 'Documents',
      description: 'Uploaded documents',
      panel: 'documents'
    },
    { 
      title: 'Projects', 
      icon: 'business-outline', 
      activeIcon: 'business',
      route: 'Projects',
      description: 'Power system projects',
      panel: 'projects'
    },
    { 
      title: 'Search', 
      icon: 'search-outline', 
      activeIcon: 'search',
      route: 'Search',
      description: 'Find projects',
      panel: 'search'
    },
    { 
      title: 'History', 
      icon: 'time-outline', 
      activeIcon: 'time',
      route: 'History',
      description: 'Conversation history',
      panel: 'history'
    },
  ];

  const handleNavigation = (item) => {
    if (onNavigate) {
      onNavigate(item.panel);
    } else if (navigation?.navigate) {
      navigation.navigate(item.route);
    }
    onClose && onClose();
  };

  return (
    <View style={styles.sidebar}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Ionicons name="flash" size={24} color="#007AFF" />
          <Text style={styles.title}>PowerNOVA</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Navigation Menu */}
      <ScrollView style={styles.menuContainer}>
        {menuItems.map((item) => {
          const isActive = currentRoute === item.route || currentRoute === item.panel;
          return (
            <TouchableOpacity
              key={item.title}
              style={[styles.menuItem, isActive && styles.activeMenuItem]}
              onPress={() => handleNavigation(item)}
            >
              <Ionicons 
                name={isActive ? item.activeIcon : item.icon} 
                size={20} 
                color={isActive ? "#007AFF" : "#666"} 
              />
              <View style={styles.menuTextContainer}>
                <Text style={[styles.menuText, isActive && styles.activeMenuText]}>
                  {item.title}
                </Text>
                <Text style={styles.menuDescription}>{item.description}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* User Section */}
      {user && (
        <View style={styles.userSection}>
          <View style={styles.userInfo}>
            <View style={styles.userAvatar}>
              <Text style={styles.userInitial}>
                {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
              </Text>
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.userName}>{user.displayName || 'User'}</Text>
              <Text style={styles.userEmail}>{user.email}</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  sidebar: {
    width: 280,
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderRightColor: '#e1e4e8',
    paddingTop: 20,
    flexDirection: 'column',
    height: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e4e8',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  closeButton: {
    padding: 4,
  },
  menuContainer: {
    flex: 1,
    paddingVertical: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginVertical: 2,
    marginHorizontal: 12,
    borderRadius: 8,
  },
  activeMenuItem: {
    backgroundColor: '#f0f8ff',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  menuTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  menuText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  activeMenuText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  menuDescription: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  userSection: {
    borderTopWidth: 1,
    borderTopColor: '#e1e4e8',
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 36,
    height: 36,
    backgroundColor: '#007AFF',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInitial: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userDetails: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  userEmail: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
});
