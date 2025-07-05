require('dotenv').config({ path: '../.env' });
const { Pinecone } = require('@pinecone-database/pinecone');

async function testPineconeConnection() {
  try {
    console.log('Testing Pinecone connection...');
    console.log('API Key:', process.env.PINECONE_API_KEY ? 'Set' : 'Not set');
    console.log('Environment:', process.env.PINECONE_ENVIRONMENT);
    console.log('Index Name:', process.env.PINECONE_INDEX_NAME);
    
    // Try without environment first
    console.log('\n--- Test 1: Without environment ---');
    try {
      const pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
      });
      
      console.log('Pinecone client created successfully (no environment)');
      
      const index = pinecone.index(process.env.PINECONE_INDEX_NAME || 'powernova-docs');
      console.log('Index reference created successfully');
      
      // Try to get index stats
      const stats = await index.describeIndexStats();
      console.log('Index stats:', stats);
      
      console.log('✅ Pinecone connection test successful (no environment)!');
      return;
      
    } catch (error) {
      console.log('❌ Test 1 failed:', error.message);
    }
    
    // Try with environment
    console.log('\n--- Test 2: With environment ---');
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
      environment: process.env.PINECONE_ENVIRONMENT,
    });
    
    console.log('Pinecone client created successfully (with environment)');
    
    const index = pinecone.index(process.env.PINECONE_INDEX_NAME || 'powernova-docs');
    console.log('Index reference created successfully');
    
    // Try to get index stats
    const stats = await index.describeIndexStats();
    console.log('Index stats:', stats);
    
    console.log('✅ Pinecone connection test successful (with environment)!');
    
  } catch (error) {
    console.error('❌ All Pinecone connection tests failed:', error);
    console.error('This might indicate:');
    console.error('1. Invalid API key');
    console.error('2. Index does not exist');
    console.error('3. Network connectivity issues');
    console.error('4. Pinecone service outage');
    process.exit(1);
  }
}

testPineconeConnection();
