import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';

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
      <View style={styles.conversationResponseContainer}>
        <Markdown style={conversationMarkdownStyles}>{conversation.response}</Markdown>
      </View>
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
  conversationResponseContainer: {
    flex: 1,
  },
});

const conversationMarkdownStyles = StyleSheet.create({
  body: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  heading1: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 0,
    marginBottom: 4,
  },
  heading2: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 0,
    marginBottom: 3,
  },
  paragraph: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
    marginTop: 0,
    marginBottom: 0,
  },
  strong: {
    fontWeight: 'bold',
  },
  em: {
    fontStyle: 'italic',
  },
  code_inline: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 2,
    paddingVertical: 1,
    borderRadius: 3,
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  code_block: {
    backgroundColor: '#f5f5f5',
    padding: 8,
    borderRadius: 6,
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginVertical: 4,
  },
  list_item: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
});

export default ConversationItem;
