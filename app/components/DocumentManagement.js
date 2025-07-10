import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DocumentUpload from './DocumentUpload';
import DocumentItem from './DocumentItem';

const DocumentManagement = ({ documents, onUpload, onDelete, onClose, isUploading, onRefresh, isRefreshing }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  
  const filteredDocuments = documents.filter(doc =>
    doc.fileName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRefresh = async () => {
    if (onRefresh) {
      console.log('🔄 DocumentManagement: Manual refresh triggered');
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
  };

  const handleDebugRefresh = async () => {
    console.log('🐛 DEBUG: Testing document refresh...');
    console.log('🐛 Current documents:', documents.length);
    documents.forEach(doc => {
      console.log(`🐛 Document: ${doc.fileName} - Status: ${doc.status} - Completed: ${doc.status === 'completed'}`);
    });
    
    if (onRefresh) {
      console.log('🐛 Calling onRefresh...');
      await onRefresh();
    } else {
      console.log('🐛 No onRefresh function provided');
    }
  };

  const actuallyRefreshing = refreshing || isRefreshing;

  const renderDocumentItem = ({ item }) => (
    <DocumentItem
      document={item}
      onDelete={onDelete}
      onSelect={(doc) => console.log('Selected document:', doc)}
    />
  );

  return (
    <View style={styles.documentManagementContainer}>
      <View style={styles.documentHeader}>
        <Text style={styles.documentTitle}>Document Library</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            onPress={handleDebugRefresh} 
            style={styles.debugButton}
          >
            <Ionicons name="bug" size={16} color="#FF9500" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={handleRefresh} 
            style={styles.refreshButton}
            disabled={actuallyRefreshing}
          >
            <Ionicons 
              name="refresh" 
              size={20} 
              color={actuallyRefreshing ? "#ccc" : "#007AFF"} 
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>

      <DocumentUpload onUpload={onUpload} isUploading={isUploading} />

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search documents..."
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
      </View>

      {filteredDocuments.length === 0 ? (
        <View style={styles.emptyDocumentsContainer}>
          <Ionicons name="document-outline" size={48} color="#ccc" />
          <Text style={styles.emptyDocumentsText}>
            {documents.length === 0 ? 'No documents uploaded yet' : 'No documents match your search'}
          </Text>
          <Text style={styles.emptyDocumentsSubtext}>
            Upload PDF, DOC, DOCX, or TXT files to get started
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredDocuments}
          renderItem={renderDocumentItem}
          keyExtractor={(item) => item.id}
          style={styles.documentList}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  documentManagementContainer: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  debugButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#fff3e0',
    marginRight: 4,
  },
  documentTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  emptyDocumentsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyDocumentsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyDocumentsSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  documentList: {
    flex: 1,
  },
});

export default DocumentManagement;
