import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatFileSize, getFileIcon } from '../documentService';

const DocumentItem = ({ document, onDelete, onSelect }) => {
  const formatDate = (date) => {
    // Handle different date formats
    let dateObj;
    
    if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === 'string') {
      dateObj = new Date(date);
    } else if (typeof date === 'number') {
      dateObj = new Date(date);
    } else if (date && date.toDate) {
      // Firestore Timestamp
      dateObj = date.toDate();
    } else {
      // Fallback to current date
      dateObj = new Date();
    }
    
    // Check if the date is valid
    if (isNaN(dateObj.getTime())) {
      dateObj = new Date();
    }
    
    return dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <TouchableOpacity style={styles.documentItem} onPress={() => onSelect(document)}>
      <View style={styles.documentItemHeader}>
        <Ionicons name={getFileIcon(document.mimeType || document.fileType)} size={24} color="#007AFF" />
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
        {document.status === 'completed' ? (
          <View style={styles.statusBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#28a745" />
            <Text style={styles.statusText}>Ready for Q&A</Text>
            {(document.chunkCount || document.vectorCount) && (
              <Text style={styles.statusSubtext}>• {document.chunkCount || document.vectorCount} chunks</Text>
            )}
          </View>
        ) : document.errorMessage || document.status === 'failed' ? (
          <View style={[styles.statusBadge, styles.statusError]}>
            <Ionicons name="alert-circle" size={16} color="#FF3B30" />
            <Text style={[styles.statusText, styles.statusErrorText]}>Processing Error</Text>
            {document.errorMessage && (
              <Text style={styles.errorSubtext}>• {document.errorMessage}</Text>
            )}
          </View>
        ) : document.status === 'processing' ? (
          <View style={[styles.statusBadge, styles.statusProcessing]}>
            <Ionicons name="cog" size={16} color="#FF9500" />
            <Text style={[styles.statusText, styles.statusProcessingText]}>Processing...</Text>
            {document.message && (
              <Text style={styles.processingSubtext}>• {document.message}</Text>
            )}
          </View>
        ) : document.status === 'queued_for_processing' ? (
          <View style={[styles.statusBadge, styles.statusQueued]}>
            <Ionicons name="time-outline" size={16} color="#6c757d" />
            <Text style={[styles.statusText, styles.statusQueuedText]}>Queued</Text>
            <Text style={styles.queuedSubtext}>• Waiting to process</Text>
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

const styles = StyleSheet.create({
  documentItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  documentItemMeta: {
    fontSize: 14,
    color: '#666',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    marginLeft: 8,
  },
  documentItemStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusError: {
    backgroundColor: '#ffe6e6',
  },
  statusProcessing: {
    backgroundColor: '#fff3e0',
  },
  statusQueued: {
    backgroundColor: '#f8f9fa',
    borderColor: '#6c757d',
    borderWidth: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#28a745',
  },
  statusSubtext: {
    fontSize: 10,
    color: '#666',
    marginLeft: 4,
  },
  statusErrorText: {
    color: '#FF3B30',
  },
  statusProcessingText: {
    color: '#FF9500',
  },
  statusQueuedText: {
    color: '#6c757d',
  },
  errorSubtext: {
    fontSize: 10,
    color: '#FF3B30',
    marginLeft: 4,
    marginTop: 2,
  },
  processingSubtext: {
    fontSize: 10,
    color: '#FF9500',
    marginLeft: 4,
    marginTop: 2,
  },
  queuedSubtext: {
    fontSize: 10,
    color: '#6c757d',
    marginLeft: 4,
    marginTop: 2,
  },
});

export default DocumentItem;
