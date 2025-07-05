import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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

const styles = StyleSheet.create({
  conversationItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  conversationTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  followUpIcon: {
    marginLeft: 4,
  },
  conversationTimestamp: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  conversationPrompt: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  conversationResponse: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
});

export default ConversationItem;
