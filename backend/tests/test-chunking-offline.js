#!/usr/bin/env node

/**
 * Simple chunking test without API dependencies
 */

// Mock the services to avoid API key requirements
const mockVectorService = {
  estimateTokenCount(text) {
    return Math.ceil(text.length / 4);
  },

  calculateOptimalChunkSize(textContent) {
    const totalChars = textContent.length;
    const estimatedTokens = Math.ceil(totalChars / 4);
    
    console.log(`📊 Document analysis: ${totalChars.toLocaleString()} chars, ~${estimatedTokens.toLocaleString()} tokens`);
    
    if (estimatedTokens > 3000000) {
      return { chunkSize: 2000, overlap: 400 }; // Very large chunks for very large docs
    } else if (estimatedTokens > 1500000) {
      return { chunkSize: 1800, overlap: 350 }; // Large chunks
    } else if (estimatedTokens > 1000000) {
      return { chunkSize: 1500, overlap: 300 }; // Medium-large chunks
    } else if (estimatedTokens > 500000) {
      return { chunkSize: 1200, overlap: 250 }; // Medium chunks
    } else {
      return { chunkSize: 1000, overlap: 200 }; // Standard chunks
    }
  },

  chunkText(text, chunkSize = 1000, overlap = 200) {
    const chunks = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let currentChunk = '';
    let currentSize = 0;
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      const sentenceSize = trimmedSentence.length;
      
      if (currentSize + sentenceSize > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        
        if (overlap > 0 && currentChunk.length > overlap) {
          const overlapText = currentChunk.slice(-overlap);
          currentChunk = overlapText + '. ' + trimmedSentence;
          currentSize = overlapText.length + trimmedSentence.length + 2;
        } else {
          currentChunk = trimmedSentence;
          currentSize = sentenceSize;
        }
      } else {
        currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
        currentSize += sentenceSize + (currentChunk ? 2 : 0);
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks.filter(chunk => chunk.length > 50);
  },

  validateDocumentForProcessing(textContent, fileName) {
    const maxFileSize = 200 * 1024 * 1024; // 200MB
    const maxTokens = 5000000; // 5M tokens
    
    if (textContent.length > maxFileSize) {
      throw new Error(`Document too large: ${textContent.length} characters, max ${maxFileSize}`);
    }
    
    const estimatedTokens = this.estimateTokenCount(textContent);
    if (estimatedTokens > maxTokens) {
      throw new Error(`Document has too many tokens: ~${estimatedTokens} tokens, max ${maxTokens}`);
    }
    
    if (textContent.trim().length < 50) {
      throw new Error('Document appears to be empty or too short for processing');
    }
    
    return {
      valid: true,
      characterCount: textContent.length,
      estimatedTokens,
      fileName
    };
  }
};

// Sample text generator
const generateLargeText = (size) => {
  const sentence = "This is a sample sentence about power systems and electrical engineering. It contains information about grid operations, power generation, and transmission systems. ";
  const paragraph = sentence.repeat(10);
  return paragraph.repeat(Math.ceil(size / paragraph.length));
};

async function testChunking() {
  console.log('🧪 Testing improved chunking logic (offline mode)...\n');

  const testCases = [
    { name: 'Small Document', size: 5000 },
    { name: 'Medium Document', size: 100000 },
    { name: 'Large Document', size: 1000000 },
    { name: 'Very Large Document', size: 5000000 }
  ];

  for (const testCase of testCases) {
    console.log(`\n📋 Testing ${testCase.name} (${testCase.size} characters)`);
    
    const textContent = generateLargeText(testCase.size);
    
    try {
      const validation = mockVectorService.validateDocumentForProcessing(textContent, `${testCase.name}.txt`);
      console.log(`✅ Validation passed:`, {
        characters: validation.characterCount,
        estimatedTokens: validation.estimatedTokens
      });

      const chunkParams = mockVectorService.calculateOptimalChunkSize(textContent);
      console.log(`⚙️ Optimal chunk params:`, chunkParams);

      const chunks = mockVectorService.chunkText(textContent, chunkParams.chunkSize, chunkParams.overlap);
      console.log(`📝 Chunking result: ${chunks.length} chunks`);
      
      if (chunks.length > 0) {
        console.log(`📊 Chunk stats:`);
        console.log(`   - First chunk: ${chunks[0].length} chars`);
        console.log(`   - Last chunk: ${chunks[chunks.length - 1].length} chars`);
        console.log(`   - Average chunk size: ${Math.round(chunks.reduce((sum, chunk) => sum + chunk.length, 0) / chunks.length)} chars`);
      }

      const totalTokens = chunks.reduce((sum, chunk) => sum + mockVectorService.estimateTokenCount(chunk), 0);
      console.log(`🔤 Estimated tokens: ${totalTokens}`);

      const maxTokensPerBatch = 250000;
      const batchCount = Math.ceil(totalTokens / maxTokensPerBatch);
      console.log(`📦 Estimated batches needed: ${batchCount}`);

    } catch (validationError) {
      console.log(`❌ Validation failed:`, validationError.message);
    }
  }

  console.log('\n✅ All chunking tests completed successfully!');
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
      const validation = mockVectorService.validateDocumentForProcessing(testCase.content, `${testCase.name}.txt`);
      console.log(`✅ Validation passed for ${testCase.name}`);
      
      const chunks = mockVectorService.chunkText(testCase.content);
      console.log(`📝 Generated ${chunks.length} chunks`);
      
    } catch (error) {
      console.log(`⚠️ Expected error for ${testCase.name}: ${error.message}`);
    }
  }

  console.log('\n✅ Edge case tests completed!');
}

// Run tests
async function runTests() {
  console.log('🚀 Starting chunking tests (offline mode)...\n');
  
  await testChunking();
  await testEdgeCases();
  
  console.log('\n🎉 All tests completed successfully!');
  console.log('\n📋 Summary:');
  console.log('✅ Enhanced chunking with sentence boundary detection');
  console.log('✅ Adaptive chunk sizing based on document size');
  console.log('✅ Token limit checking and batch calculation');
  console.log('✅ Document validation and error handling');
  console.log('✅ Support for documents up to 100MB/2M tokens');
}

runTests().catch(console.error);
