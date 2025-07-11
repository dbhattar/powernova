const Typesense = require('typesense');

console.log('🧪 Simple Typesense Connection Test');

const client = new Typesense.Client({
  apiKey: 'powernova-api-key',
  nodes: [{
    host: 'localhost',
    port: '8108',
    protocol: 'http'
  }],
  connectionTimeoutSeconds: 5
});

async function test() {
  try {
    console.log('Testing health endpoint...');
    const health = await client.health.retrieve();
    console.log('✅ Health endpoint works:', health);

    console.log('\nTesting collections endpoint...');
    const collections = await client.collections().retrieve();
    console.log('✅ Collections endpoint works:', collections);

  } catch (error) {
    console.error('❌ Operation failed:', error.message);
    console.error('Full error:', error);
  }
}

test();
