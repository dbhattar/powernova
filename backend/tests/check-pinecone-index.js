#!/usr/bin/env node

/**
 * Check Pinecone index configuration
 */

const { Pinecone } = require('@pinecone-database/pinecone');
require('dotenv').config({ path: '../.env' });

async function checkPineconeIndex() {
  try {
    if (!process.env.PINECONE_API_KEY) {
      console.log('❌ PINECONE_API_KEY not found in environment');
      return;
    }

    console.log('🔍 Checking Pinecone index configuration...');
    
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY
    });

    const indexName = process.env.PINECONE_INDEX_NAME || 'powernova-docs';
    console.log('📋 Index name:', indexName);

    const index = pinecone.index(indexName);
    
    // Get index stats
    const stats = await index.describeIndexStats();
    console.log('📊 Index stats:', JSON.stringify(stats, null, 2));

    // Try to list available indexes
    const indexes = await pinecone.listIndexes();
    console.log('📋 Available indexes:', indexes);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkPineconeIndex().then(() => {
  console.log('✅ Check completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Check failed:', error);
  process.exit(1);
});
