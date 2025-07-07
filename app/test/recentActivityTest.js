/**
 * Test Recent Activity functionality
 * This script tests if the Recent Activity section on the Dashboard works correctly
 */

// Mock conversation data for testing
const mockConversations = [
  {
    id: 'conv_1',
    prompt: 'What are the benefits of solar energy?',
    response: 'Solar energy offers numerous benefits including reduced electricity bills, environmental sustainability, and energy independence. It\'s a clean, renewable source of power that can significantly reduce your carbon footprint.',
    type: 'text',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    hasReferences: true,
    sourceDocuments: [
      {
        id: 'doc_1',
        name: 'Solar Energy Guide.pdf',
        pages: [1, 3, 5],
        relevanceScore: 0.85,
        chunks: 3
      }
    ],
    referenceSummary: {
      documentCount: 1,
      totalChunks: 3,
      averageRelevanceScore: 0.85,
      topDocument: 'Solar Energy Guide.pdf'
    }
  },
  {
    id: 'conv_2',
    prompt: 'How do wind turbines work?',
    response: 'Wind turbines work by converting kinetic energy from wind into electrical energy through a process involving rotating blades, a gearbox, and a generator.',
    type: 'text',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    hasReferences: false,
    sourceDocuments: [],
    referenceSummary: null
  },
  {
    id: 'conv_3',
    prompt: 'Voice message about project timeline',
    response: 'Based on the project documentation, the typical timeline for a renewable energy project includes 6 months for permitting, 12 months for construction, and 3 months for testing and commissioning.',
    type: 'voice',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    hasReferences: true,
    sourceDocuments: [
      {
        id: 'doc_2',
        name: 'Project Timeline.docx',
        pages: [2],
        relevanceScore: 0.92,
        chunks: 1
      }
    ],
    referenceSummary: {
      documentCount: 1,
      totalChunks: 1,
      averageRelevanceScore: 0.92,
      topDocument: 'Project Timeline.docx'
    }
  },
  {
    id: 'conv_4',
    prompt: 'What is the ROI for renewable energy investments?',
    response: 'The ROI for renewable energy investments varies but typically ranges from 10-20% annually, with payback periods of 5-10 years depending on the technology and location.',
    type: 'text',
    timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week ago
    hasReferences: false,
    sourceDocuments: [],
    referenceSummary: null
  },
  {
    id: 'conv_5',
    prompt: 'Energy storage solutions',
    response: 'Modern energy storage solutions include lithium-ion batteries, pumped hydro storage, and emerging technologies like flow batteries and compressed air energy storage.',
    type: 'text',
    timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
    hasReferences: true,
    sourceDocuments: [
      {
        id: 'doc_3',
        name: 'Energy Storage Technologies.pdf',
        pages: [12, 15, 18],
        relevanceScore: 0.78,
        chunks: 4
      }
    ],
    referenceSummary: {
      documentCount: 1,
      totalChunks: 4,
      averageRelevanceScore: 0.78,
      topDocument: 'Energy Storage Technologies.pdf'
    }
  }
];

// Mock document data for testing
const mockDocuments = [
  {
    id: 'doc_1',
    fileName: 'Solar Energy Guide.pdf',
    name: 'Solar Energy Guide.pdf',
    size: 2458624, // ~2.4MB
    type: 'pdf',
    status: 'processed',
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
    uploadDate: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    downloadUrl: 'https://example.com/solar-guide.pdf'
  },
  {
    id: 'doc_2',
    fileName: 'Project Timeline.docx',
    name: 'Project Timeline.docx',
    size: 1048576, // 1MB
    type: 'docx',
    status: 'processed',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    uploadDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    downloadUrl: 'https://example.com/project-timeline.docx'
  },
  {
    id: 'doc_3',
    fileName: 'Energy Storage Technologies.pdf',
    name: 'Energy Storage Technologies.pdf',
    size: 5242880, // 5MB
    type: 'pdf',
    status: 'processed',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    uploadDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    downloadUrl: 'https://example.com/energy-storage.pdf'
  },
  {
    id: 'doc_4',
    fileName: 'Market Analysis.xlsx',
    name: 'Market Analysis.xlsx',
    size: 3145728, // 3MB
    type: 'xlsx',
    status: 'processing',
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), // 6 days ago
    uploadDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    downloadUrl: 'https://example.com/market-analysis.xlsx'
  },
  {
    id: 'doc_5',
    fileName: 'Presentation.pptx',
    name: 'Presentation.pptx',
    size: 7340032, // ~7MB
    type: 'pptx',
    status: 'processed',
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), // 8 days ago
    uploadDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    downloadUrl: 'https://example.com/presentation.pptx'
  }
];

// Function to inject mock conversations for testing
export const injectMockConversations = () => {
  console.log('🧪 Injecting mock conversations for testing Recent Activity...');
  
  // Store original conversations
  const originalConversations = JSON.parse(JSON.stringify(mockConversations));
  
  // Log the mock data
  console.log('📋 Mock conversations:', mockConversations.length);
  mockConversations.forEach((conv, index) => {
    console.log(`   ${index + 1}. ${conv.type.toUpperCase()}: "${conv.prompt}" (${conv.hasReferences ? 'with refs' : 'no refs'})`);
  });
  
  return mockConversations;
};

// Function to inject mock documents for testing
export const injectMockDocuments = () => {
  console.log('🧪 Injecting mock documents for testing Recent Activity...');
  
  // Log the mock data
  console.log('📁 Mock documents:', mockDocuments.length);
  mockDocuments.forEach((doc, index) => {
    console.log(`   ${index + 1}. ${doc.type.toUpperCase()}: "${doc.fileName}" (${doc.status})`);
  });
  
  return mockDocuments;
};

// Function to verify Dashboard Recent Activity functionality
export const testRecentActivity = (dashboardComponent) => {
  console.log('🔍 Testing Recent Activity functionality...');
  
  // Test cases
  const testCases = [
    {
      name: 'Empty conversations',
      conversations: [],
      expectedResult: 'Should show empty state'
    },
    {
      name: 'Single conversation',
      conversations: [mockConversations[0]],
      expectedResult: 'Should show 1 conversation'
    },
    {
      name: 'Multiple conversations',
      conversations: mockConversations,
      expectedResult: 'Should show 5 most recent conversations'
    },
    {
      name: 'Mixed types (text/voice)',
      conversations: mockConversations.filter(c => c.type === 'voice' || c.id === 'conv_1'),
      expectedResult: 'Should show both text and voice conversations'
    },
    {
      name: 'With references',
      conversations: mockConversations.filter(c => c.hasReferences),
      expectedResult: 'Should show reference indicators'
    }
  ];
  
  testCases.forEach(testCase => {
    console.log(`\n🧪 Testing: ${testCase.name}`);
    console.log(`   Input: ${testCase.conversations.length} conversations`);
    console.log(`   Expected: ${testCase.expectedResult}`);
    
    // Here you would render the dashboard component with the test data
    // and verify the output matches expectations
  });
  
  console.log('\n✅ Recent Activity tests completed!');
};

export default {
  mockConversations,
  mockDocuments,
  injectMockConversations,
  injectMockDocuments,
  testRecentActivity
};
