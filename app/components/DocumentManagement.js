import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DocumentUpload from './DocumentUpload';
import DocumentItem from './DocumentItem';
import { testStoragePermissions } from '../storageTest';
import { checkDocumentsInFirestore } from '../firestoreTest';
import { testConversations, testSaveConversation } from '../conversationTest';

const DocumentManagement = ({ documents, onUpload, onDelete, onClose, isUploading }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredDocuments = documents.filter(doc =>
    doc.fileName.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <DocumentUpload onUpload={onUpload} isUploading={isUploading} />

      {/* Debug: Storage permission test button */}
      <View style={styles.debugContainer}>
        <TouchableOpacity
          style={styles.testButton}
          onPress={() => testStoragePermissions()}
        >
          <Ionicons name="shield-checkmark-outline" size={16} color="#FF9500" />
          <Text style={styles.testButtonText}>Test Storage Permissions</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.testButton, { marginTop: 8 }]}
          onPress={() => checkDocumentsInFirestore()}
        >
          <Ionicons name="documents-outline" size={16} color="#007AFF" />
          <Text style={[styles.testButtonText, { color: '#007AFF' }]}>Check Documents in DB</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.testButton, { marginTop: 8 }]}
          onPress={() => testConversations()}
        >
          <Ionicons name="chatbubbles-outline" size={16} color="#28a745" />
          <Text style={[styles.testButtonText, { color: '#28a745' }]}>Check Conversations</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.testButton, { marginTop: 8 }]}
          onPress={() => testSaveConversation()}
        >
          <Ionicons name="add-circle-outline" size={16} color="#DC3545" />
          <Text style={[styles.testButtonText, { color: '#DC3545' }]}>Test Save Conversation</Text>
        </TouchableOpacity>
        
        {/* Debug: Test delete function */}
        {documents.length > 0 && (
          <TouchableOpacity
            style={[styles.testButton, { marginTop: 8, backgroundColor: '#FF3B30' }]}
            onPress={() => {
              console.log('🧪 Debug: Testing delete function with first document');
              const firstDoc = documents[0];
              console.log('🧪 First document:', firstDoc);
              onDelete(firstDoc);
            }}
          >
            <Ionicons name="trash-outline" size={16} color="white" />
            <Text style={[styles.testButtonText, { color: 'white' }]}>🧪 Test Delete (Debug)</Text>
          </TouchableOpacity>
        )}
      </View>

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
  debugContainer: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF9500',
    gap: 8,
  },
  testButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FF9500',
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
