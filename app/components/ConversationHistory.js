import React from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ConversationItem from './ConversationItem';

// Try to import the full document viewer service, fallback to simple version
let DocumentViewerService;
try {
  DocumentViewerService = require('../services/documentViewerService').default;
} catch (error) {
  console.warn('Using simple document viewer service as fallback');
  DocumentViewerService = require('../services/simpleDocumentViewerService').default;
}

const ConversationHistory = ({ conversations, onClose, onConversationSelect, formatTimestamp }) => {
  const handleDocumentPress = async (documentId, page) => {
    try {
      await DocumentViewerService.handleDocumentPress(documentId, page);
    } catch (error) {
      console.error('Error opening document:', error);
    }
  };

  const renderConversationItem = ({ item }) => (
    <ConversationItem 
      conversation={{
        ...item,
        formatTimestamp: () => formatTimestamp(item.timestamp)
      }}
      onPress={() => onConversationSelect(item)}
      onDocumentPress={handleDocumentPress}
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

const styles = StyleSheet.create({
  historyContainer: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  historyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  historyCloseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  emptyHistoryContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyHistoryText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyHistorySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  conversationList: {
    flex: 1,
  },
});

export default ConversationHistory;
