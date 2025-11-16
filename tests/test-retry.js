#!/usr/bin/env node

/**
 * Test script to verify retry mechanism works
 */

const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');

async function testRetryMechanism() {
  console.log('🔍 Testing retry mechanism...');
  
  try {
    // Create form data
    const form = new FormData();
    form.append('document', fs.createReadStream('./test-retry-document.txt'));
    
    // Upload document
    const response = await fetch('http://localhost:3002/api/documents/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer test-token`,
        ...form.getHeaders()
      },
      body: form
    });
    
    console.log('📡 Upload response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Upload failed:', errorText);
      return;
    }
    
    const uploadData = await response.json();
    console.log('✅ Upload successful:', JSON.stringify(uploadData, null, 2));
    
    console.log('🔄 Document processing started. Check backend logs for retry behavior.');
    console.log('📝 Look for messages like:');
    console.log('   ⚠️  Attempt X/Y failed: Gateway timeout - Pinecone server took too long to respond');
    console.log('   ⏳ Retrying in Xms...');
    console.log('   ✅ Upsert succeeded on attempt X');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testRetryMechanism();
