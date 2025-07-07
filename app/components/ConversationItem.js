import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';

const ConversationItem = ({ conversation, onPress, onDocumentPress, showPlayButton = false, isPlaying = false, onPlayPress }) => {
  const handleDocumentPress = (documentId, page) => {
    if (onDocumentPress) {
      onDocumentPress(documentId, page);
    }
  };

  const renderDocumentReferences = () => {
    if (!conversation.sourceDocuments || conversation.sourceDocuments.length === 0) {
      return null;
    }

    return (
      <View style={styles.documentReferencesContainer}>
        <Text style={styles.documentReferencesTitle}>📄 References:</Text>
        {conversation.sourceDocuments.map((doc, index) => (
          <TouchableOpacity
            key={doc.id}
            style={styles.documentReference}
            onPress={() => handleDocumentPress(doc.id, doc.pages?.[0])}
          >
            <Ionicons name="document-text" size={14} color="#007AFF" />
            <Text style={styles.documentName}>
              {doc.name}
              {doc.pages && doc.pages.length > 0 && (
                <Text style={styles.documentPages}> (p. {doc.pages.join(', ')})</Text>
              )}
            </Text>
            {doc.chunks > 1 && (
              <Text style={styles.documentChunks}>• {doc.chunks} sections</Text>
            )}
          </TouchableOpacity>
        ))}
        {conversation.referenceSummary && (
          <Text style={styles.referenceSummary}>
            Based on {conversation.referenceSummary.documentCount} document{conversation.referenceSummary.documentCount > 1 ? 's' : ''} 
            ({conversation.referenceSummary.totalChunks} sections)
          </Text>
        )}
      </View>
    );
  };

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
          {conversation.hasReferences && (
            <Ionicons 
              name="document-text" 
              size={12} 
              color="#28A745" 
              style={styles.referencesIcon}
            />
          )}
        </View>
      </View>
      <Text style={styles.conversationPrompt} numberOfLines={2}>
        {conversation.isFollowUp ? '↳ ' : ''}{conversation.prompt}
      </Text>
      <View style={styles.conversationResponseContainer}>
        <Markdown style={conversationMarkdownStyles}>{conversation.response}</Markdown>
        {showPlayButton && conversation.response && (
          <TouchableOpacity 
            onPress={onPlayPress}
            style={styles.playButton}
          >
            <Ionicons 
              name={isPlaying ? "stop-circle" : "play-circle"} 
              size={16} 
              color="#007AFF" 
            />
            <Text style={styles.playButtonText}>
              {isPlaying ? "Stop" : "Play"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      {renderDocumentReferences()}
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
  referencesIcon: {
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
  documentReferencesContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  documentReferencesTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  documentReference: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  documentName: {
    fontSize: 13,
    color: '#007AFF',
    marginLeft: 6,
    flex: 1,
  },
  documentPages: {
    color: '#666',
    fontSize: 12,
  },
  documentChunks: {
    fontSize: 11,
    color: '#666',
    marginLeft: 6,
  },
  referenceSummary: {
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
    textAlign: 'center',
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  playButtonText: {
    fontSize: 12,
    color: '#007AFF',
    marginLeft: 4,
    fontWeight: '500',
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
