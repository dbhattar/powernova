# PowerNOVA Backend Setup Guide

## Overview

This backend service provides secure API endpoints for PowerNOVA, handling:
- User authentication (Firebase ID token verification)
- OpenAI API calls (chat, transcription, embeddings)
- Vector database operations (Pinecone)
- Document processing and storage
- Conversation management

## Prerequisites

1. **Node.js 18+** installed
2. **Firebase project** with authentication enabled
3. **Vector database account** (Pinecone recommended)
4. **OpenAI API key**

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Environment Setup

Copy the example environment file and configure it:
```bash
cp .env.example .env
# Edit .env with your actual configuration
```

**Important**: Make sure to set the database credentials in `.env`:
```env
POWERNOVA_HOST=localhost
POWERNOVA_PORT=5432
POWERNOVA_DB=powernova
POWERNOVA_USER=postgres
POWERNOVA_PASSWORD=your_actual_password
```

### 3. Database Setup

Run the database migration to create all necessary tables:
```bash
npm run migrate
```

This will:
- Test database connection
- Create the database if it doesn't exist
- Create all tables (users, user_settings, QueueInfo)
- Set up indexes and triggers

```env
# Server Configuration
NODE_ENV=development
PORT=3001

# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here

# Pinecone Configuration
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_ENVIRONMENT=your-pinecone-environment
PINECONE_INDEX_NAME=powernova-docs

# Firebase Admin Configuration
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=your-firebase-service-account-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour-private-key-here\n-----END PRIVATE KEY-----"

# Security
CORS_ORIGIN=http://localhost:8081,exp://192.168.1.100:8081
```

### 3. Firebase Service Account Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** > **Service Accounts**
4. Click **"Generate new private key"**
5. Download the JSON file
6. Extract the required values for your `.env`:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (include the full key with newlines)

### 4. Pinecone Setup

1. Create account at [Pinecone](https://pinecone.io/)
2. Create a new index:
   - **Name**: `powernova-docs`
   - **Dimensions**: `1536` (for OpenAI text-embedding-3-small)
   - **Metric**: `cosine`
   - **Pod Type**: `s1.x1` (starter)
3. Get your API key and environment from the dashboard

### 5. Start the Server

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The server will start on `http://localhost:3001`

## API Endpoints

### Authentication
All endpoints require Firebase ID token in Authorization header:
```
Authorization: Bearer <firebase-id-token>
```

### Chat Endpoints

#### Send Message
```http
POST /api/chat/message
Content-Type: application/json

{
  "message": "How does grid stability work?",
  "threadId": "optional-thread-id",
  "isFollowUp": false
}
```

#### Transcribe Audio
```http
POST /api/chat/transcribe
Content-Type: multipart/form-data

audio: <audio-file>
autoSend: true
threadId: optional-thread-id
```

#### Get History
```http
GET /api/chat/history?limit=50&offset=0
```

#### Get Thread
```http
GET /api/chat/thread/{threadId}
```

### Document Endpoints

#### Upload Document
```http
POST /api/documents/upload
Content-Type: multipart/form-data

document: <pdf|docx|txt-file>
```

#### List Documents
```http
GET /api/documents
```

#### Delete Document
```http
DELETE /api/documents/{documentId}
```

#### Get Document Status
```http
GET /api/documents/{documentId}/status
```

### Vector Endpoints

#### Search Documents
```http
POST /api/vectors/search
Content-Type: application/json

{
  "query": "search query",
  "topK": 10,
  "scoreThreshold": 0.7
}
```

#### Get Statistics
```http
GET /api/vectors/stats
```

## Development

### Running Tests
```bash
npm test
```

### Code Structure

```
src/
├── controllers/     # Route handlers
├── middleware/      # Auth, rate limiting
├── services/        # Business logic
├── utils/          # Helpers
└── app.js          # Express app setup
```

### Adding New Features

1. Add route in appropriate controller
2. Implement business logic in service
3. Add tests
4. Update documentation

## Deployment

### Environment Variables for Production

```env
NODE_ENV=production
PORT=3001
OPENAI_API_KEY=your-production-key
PINECONE_API_KEY=your-production-key
FIREBASE_PROJECT_ID=your-production-project
# ... other production values
```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src/ ./src/
EXPOSE 3001
CMD ["npm", "start"]
```

### Cloud Deployment Options

1. **Heroku**
2. **Google Cloud Run**
3. **AWS Lambda** (with serverless framework)
4. **Digital Ocean App Platform**
5. **Railway**

## Security Considerations

1. **API Keys**: Never commit API keys to version control
2. **CORS**: Configure appropriate origins for production
3. **Rate Limiting**: Adjust limits based on usage patterns
4. **Logging**: Remove sensitive data from logs in production
5. **HTTPS**: Always use HTTPS in production

## Monitoring & Logging

The backend includes:
- Request logging
- Error tracking
- Performance monitoring
- Health check endpoint (`/health`)

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Verify Firebase service account setup
   - Check ID token format
   - Ensure user is signed in on frontend

2. **Pinecone Connection Issues**
   - Verify API key and environment
   - Check index name and dimensions
   - Ensure index is active

3. **OpenAI API Errors**
   - Check API key validity
   - Monitor usage limits
   - Verify model availability

## 🚨 Troubleshooting Environment Variables

If you encounter errors like:
- `psql: error: could not translate host name "-U" to address`
- `Python script connecting to localhost instead of your database`
- `Environment variables not found`

**Quick fix:**
1. Ensure `.env` file exists: `cp .env.example .env`
2. Edit `.env` with your actual database credentials
3. Use the provided scripts that properly load environment variables

**For detailed troubleshooting:** See [ENV_TROUBLESHOOTING.md](./ENV_TROUBLESHOOTING.md)

**Debug tools:**
```bash
npm run debug-queue-env  # Debug environment variable loading
npm run test-integration # Test the complete setup
```

## Frontend Integration

Update your frontend's `app.json`:

```json
{
  "expo": {
    "extra": {
      "backendUrl": "https://your-backend-url.com/api",
      "mainHeading": "PowerNOVA"
    }
  }
}
```

## Next Steps

1. Set up monitoring and logging
2. Implement caching for frequent queries
3. Add WebSocket support for real-time updates
4. Implement advanced vector search features
5. Add API documentation with Swagger/OpenAPI

## 🔥 New: ISO/RTO Queue Projects Integration

PowerNOVA now supports real-time ISO/RTO interconnection queue data integration! The system can automatically fetch and serve project data from major grid operators.

### Quick Setup for Queue Projects

```bash
# 1. Set up Python environment and dependencies
npm run setup-queue-projects

# 2. Test the integration
npm run test-integration

# 3. Populate data for specific ISO (e.g., CAISO)
npm run populate-queue-data populate CAISO

# 4. Or populate all available ISOs
npm run populate-all-isos
```

### Available Queue Project Commands

| Command | Description |
|---------|-------------|
| `npm run setup-queue-projects` | Initial setup of Python environment |
| `npm run test-integration` | Test the complete integration |
| `npm run populate-queue-data <iso>` | Populate specific ISO data |
| `npm run populate-all-isos` | Populate all available ISOs |
| `npm run list-isos` | List available ISOs |

### Enhanced Progress Feedback 🚀

The queue data population scripts now provide comprehensive progress feedback:

- **Real-time Progress Bar**: Visual indication of completion percentage
- **Processing Metrics**: Records per second, ETA, batch completion status
- **Detailed Statistics**: Fetch time, processing time, success/error counts
- **Multi-ISO Summary**: Overall statistics when populating all ISOs

Example output:
```
📊 NYISO: [███████████████████░░░░░░░░░░░] 66.1% (1,400/2,119) - 16 rec/s - ETA: 0.8m - ✅1400 ❌0

🎉 NYISO Population Complete!
   📊 Successfully processed: 2,119/2,119 records (100.0%)
   ⏱️  Total time: 137.9s (fetch: 2.3s, process: 135.7s)
   🚀 Processing rate: 16 records/second
```

**📖 For progress feedback details, see [PROGRESS_FEEDBACK_IMPROVEMENTS.md](./PROGRESS_FEEDBACK_IMPROVEMENTS.md)**

**📖 For detailed setup instructions, see [QUEUE_PROJECTS_INTEGRATION.md](./QUEUE_PROJECTS_INTEGRATION.md)**

---
