import React, { useState } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sidebar } from '../ui/Sidebar';

const { width } = Dimensions.get('window');

export const MainLayout = ({ children, navigation, user, currentRoute, onNavigate }) => {
  const [sidebarVisible, setSidebarVisible] = useState(false);

  const toggleSidebar = () => {
    setSidebarVisible(!sidebarVisible);
  };

  return (
    <View style={styles.container}>
      {/* Hamburger Menu Button */}
      <TouchableOpacity
        style={styles.menuButton}
        onPress={toggleSidebar}
      >
        <Ionicons name="menu" size={24} color="#007AFF" />
      </TouchableOpacity>

      {/* Sidebar Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={sidebarVisible}
        onRequestClose={() => setSidebarVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalOverlay} onTouchStart={() => setSidebarVisible(false)} />
          <View style={styles.sidebarContainer}>
            <Sidebar
              navigation={navigation}
              user={user}
              currentRoute={currentRoute}
              onClose={() => setSidebarVisible(false)}
              onNavigate={onNavigate}
            />
          </View>
        </View>
      </Modal>
      
      {/* Main Content */}
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  menuButton: {
    position: 'absolute',
    top: 50,
    left: 16,
    zIndex: 10,
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modalContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sidebarContainer: {
    width: 280,
  },
  content: {
    flex: 1,
    paddingTop: 80, // Account for menu button
  },
});
