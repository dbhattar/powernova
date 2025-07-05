require('dotenv').config({ path: '../.env' });
const { Pinecone } = require('@pinecone-database/pinecone');

async function testPineconeConnection() {
  try {
    console.log('Testing Pinecone connection with new SDK (API version 2025-04)...');
    console.log('API Key:', process.env.PINECONE_API_KEY ? 'Set' : 'Not set');
    console.log('Index Name:', process.env.PINECONE_INDEX_NAME);
    
    // Use new simplified initialization
    const pc = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY
    });
    
    console.log('✅ Pinecone client created successfully');
    
    const index = pc.index(process.env.PINECONE_INDEX_NAME || 'powernova-docs');
    console.log('✅ Index reference created successfully');
    
    // Try to get index stats
    const stats = await index.describeIndexStats();
    console.log('✅ Index stats retrieved successfully:');
    console.log('   - Dimension:', stats.dimension);
    console.log('   - Total vectors:', stats.totalVectorCount);
    console.log('   - Namespaces:', Object.keys(stats.namespaces || {}));
    
    console.log('\n🎉 Pinecone connection test SUCCESSFUL!');
    console.log('Vector search will be available in the application.');
    
  } catch (error) {
    console.error('❌ Pinecone connection test failed:', error.message);
    console.error('\nPossible issues:');
    console.error('1. Invalid API key');
    console.error('2. Index does not exist');
    console.error('3. Network connectivity issues');
    console.error('4. Pinecone service outage');
    console.error('\nThe app will continue to work without vector search.');
    process.exit(1);
  }
}

testPineconeConnection();
