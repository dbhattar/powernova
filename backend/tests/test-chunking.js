#!/usr/bin/env node

/**
 * Test script for improved chunking and embedding logic
 */

const vectorService = require('../src/services/vectorService');

// Sample large text content
const generateLargeText = (size) => {
  const sentence = "This is a sample sentence about power systems and electrical engineering. It contains information about grid operations, power generation, and transmission systems. ";
  const paragraph = sentence.repeat(10);
  return paragraph.repeat(Math.ceil(size / paragraph.length));
};

async function testChunking() {
  console.log('🧪 Testing improved chunking and embedding logic...\n');

  try {
    // Test different document sizes
    const testCases = [
      { name: 'Small Document', size: 5000 },      // ~5KB
      { name: 'Medium Document', size: 100000 },   // ~100KB  
      { name: 'Large Document', size: 1000000 },   // ~1MB
      { name: 'Very Large Document', size: 5000000 } // ~5MB
    ];

    for (const testCase of testCases) {
      console.log(`\n📋 Testing ${testCase.name} (${testCase.size} characters)`);
      
      const textContent = generateLargeText(testCase.size);
      
      // Test validation
      try {
        const validation = vectorService.validateDocumentForProcessing(textContent, `${testCase.name}.txt`);
        console.log(`✅ Validation passed:`, {
          characters: validation.characterCount,
          estimatedTokens: validation.estimatedTokens
        });
      } catch (validationError) {
        console.log(`❌ Validation failed:`, validationError.message);
        continue;
      }

      // Test optimal chunk calculation
      const chunkParams = vectorService.calculateOptimalChunkSize(textContent);
      console.log(`⚙️ Optimal chunk params:`, chunkParams);

      // Test chunking
      const chunks = vectorService.chunkText(textContent, chunkParams.chunkSize, chunkParams.overlap);
      console.log(`📝 Chunking result: ${chunks.length} chunks`);
      
      if (chunks.length > 0) {
        console.log(`📊 Chunk stats:`);
        console.log(`   - First chunk: ${chunks[0].length} chars`);
        console.log(`   - Last chunk: ${chunks[chunks.length - 1].length} chars`);
        console.log(`   - Average chunk size: ${Math.round(chunks.reduce((sum, chunk) => sum + chunk.length, 0) / chunks.length)} chars`);
      }

      // Test token estimation
      const totalTokens = chunks.reduce((sum, chunk) => sum + vectorService.estimateTokenCount(chunk), 0);
      console.log(`🔤 Estimated tokens: ${totalTokens}`);

      // Test batch calculation
      const maxTokensPerBatch = 250000;
      const batchCount = Math.ceil(totalTokens / maxTokensPerBatch);
      console.log(`📦 Estimated batches needed: ${batchCount}`);
    }

    console.log('\n✅ All chunking tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Test edge cases
async function testEdgeCases() {
  console.log('\n🧪 Testing edge cases...\n');

  const edgeCases = [
    { name: 'Empty Document', content: '' },
    { name: 'Very Short Document', content: 'Short.' },
    { name: 'No Sentences', content: 'noseparatorsinthisdocumentjustoneblock'.repeat(100) },
    { name: 'Many Short Sentences', content: Array(1000).fill('Short sentence.').join(' ') }
  ];

  for (const testCase of edgeCases) {
    console.log(`📋 Testing ${testCase.name}`);
    
    try {
      const validation = vectorService.validateDocumentForProcessing(testCase.content, `${testCase.name}.txt`);
      console.log(`✅ Validation passed for ${testCase.name}`);
      
      const chunks = vectorService.chunkText(testCase.content);
      console.log(`📝 Generated ${chunks.length} chunks`);
      
    } catch (error) {
      console.log(`⚠️ Expected error for ${testCase.name}: ${error.message}`);
    }
  }

  console.log('\n✅ Edge case tests completed!');
}

// Run tests
async function runTests() {
  console.log('🚀 Starting chunking and embedding tests...\n');
  
  await testChunking();
  await testEdgeCases();
  
  console.log('\n🎉 All tests completed!');
}

// Run if called directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testChunking, testEdgeCases, runTests };
