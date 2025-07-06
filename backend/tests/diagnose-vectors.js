#!/usr/bin/env node

/**
 * Diagnostic script to check vector database and document storage
 */

require('dotenv').config();

const vectorService = require('../src/services/vectorService');
const firebaseService = require('../src/services/firebaseService');

async function checkVectorDatabase() {
  console.log('🔍 Checking Vector Database Status...\n');

  try {
    // Initialize vector service
    await vectorService.initialize();
    
    if (!vectorService.isAvailable()) {
      console.log('❌ Vector service is not available');
      return;
    }
    
    console.log('✅ Vector service is available');
    
    // Get index stats
    const stats = await vectorService.getDocumentStats('6mB5hZWnmKQzVkiPaptb2mqTQMs1');
    console.log('📊 Vector Database Stats:', stats);
    
    // Get index description
    try {
      const indexStats = await vectorService.index.describeIndexStats();
      console.log('\n📋 Full Index Stats:');
      console.log('   Total vectors:', indexStats.totalVectorCount);
      console.log('   Index dimension:', indexStats.dimension);
      console.log('   Namespaces:', Object.keys(indexStats.namespaces || {}));
      
      if (indexStats.namespaces) {
        Object.entries(indexStats.namespaces).forEach(([namespace, stats]) => {
          console.log(`   - ${namespace}: ${stats.vectorCount} vectors`);
        });
      }
    } catch (error) {
      console.log('⚠️ Could not get detailed index stats:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Vector database check failed:', error);
  }
}

async function checkFirestoreDocuments() {
  console.log('\n🔍 Checking Firestore Documents...\n');
  
  try {
    // Get documents from Firestore
    const documents = await firebaseService.getUserDocuments('6mB5hZWnmKQzVkiPaptb2mqTQMs1');
    console.log(`📄 Found ${documents.length} documents in Firestore`);
    
    documents.forEach((doc, index) => {
      console.log(`   ${index + 1}. ${doc.fileName} (${doc.fileSize} bytes, ${doc.processingStatus})`);
    });
    
    // Check for completed documents
    const completedDocs = documents.filter(doc => doc.isProcessed);
    console.log(`✅ ${completedDocs.length} documents fully processed`);
    
    const processingDocs = documents.filter(doc => doc.processingStatus === 'processing');
    console.log(`⏳ ${processingDocs.length} documents still processing`);
    
    const errorDocs = documents.filter(doc => doc.processingStatus === 'error');
    console.log(`❌ ${errorDocs.length} documents with errors`);
    
  } catch (error) {
    console.error('❌ Firestore document check failed:', error);
  }
}

async function testSearch() {
  console.log('\n🔍 Testing Search Functionality...\n');
  
  try {
    await vectorService.initialize();
    
    const testQueries = [
      'power systems',
      'electrical grid',
      'transmission lines',
      'voltage regulation',
      'renewable energy'
    ];
    
    for (const query of testQueries) {
      console.log(`\n🔍 Testing query: "${query}"`);
      
      const results = await vectorService.searchDocuments('6mB5hZWnmKQzVkiPaptb2mqTQMs1', query, 3);
      console.log(`   Found ${results.length} results`);
      
      if (results.length > 0) {
        results.forEach((result, index) => {
          console.log(`   ${index + 1}. Score: ${result.score?.toFixed(4)}, File: ${result.metadata?.fileName}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Search test failed:', error);
  }
}

async function runDiagnostics() {
  console.log('🚀 Starting Vector Database Diagnostics...\n');
  
  await checkVectorDatabase();
  await checkFirestoreDocuments();
  await testSearch();
  
  console.log('\n🎉 Diagnostics completed!');
  
  console.log('\n📋 Troubleshooting Tips:');
  console.log('1. If no vectors found: Check if documents were uploaded and processed successfully');
  console.log('2. If search returns no results: Check if user ID matches between upload and search');
  console.log('3. If low similarity scores: Try broader search terms or check document content');
  console.log('4. If vector service unavailable: Check Pinecone API key and index name');
}

runDiagnostics().catch(console.error);
