# PowerNOVA Setup Guide

PowerNOVA is an AI-powered assistant specialized in power systems and electrical engineering, built with React Native (Expo) frontend and Node.js/Express backend.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Git

### One-Command Setup

```bash
# Clone the repository
git clone https://github.com/your-username/powernova.git
cd powernova

# Run the setup script
chmod +x setup.sh
./setup.sh
```

The setup script will:
- ✅ Check system requirements
- ✅ Install all dependencies
- ✅ Create configuration templates
- ✅ Set up development scripts
- ✅ Provide detailed setup instructions

## 🏗️ Manual Setup

If you prefer manual setup:

### 1. Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../app
npm install
```

### 2. Configure Environment Variables

#### Backend (.env)
```bash
cd backend
cp .env.example .env
# Edit .env with your API keys
```

Required variables:
- `OPENAI_API_KEY` - Your OpenAI API key
- `PINECONE_API_KEY` - Your Pinecone API key
- `PINECONE_ENVIRONMENT` - Your Pinecone environment
- `PINECONE_INDEX_NAME` - Your Pinecone index name
- `FIREBASE_PROJECT_ID` - Your Firebase project ID
- `FIREBASE_PRIVATE_KEY` - Your Firebase private key
- `FIREBASE_CLIENT_EMAIL` - Your Firebase client email

#### Frontend (Firebase Config)
```bash
cd app
# Edit firebase.js with your Firebase configuration
```

### 3. Start Development

```bash
# Start both backend and frontend
npm run dev

# Or start individually
npm run dev:backend  # Backend only
npm run dev:frontend # Frontend only
```

## 📁 Project Structure

```
powernova/
├── app/                    # React Native frontend
│   ├── components/         # Reusable UI components
│   ├── App.js             # Main application component
│   ├── firebase.js        # Firebase configuration
│   └── package.json       # Frontend dependencies
├── backend/               # Node.js backend
│   ├── src/
│   │   ├── controllers/   # API route controllers
│   │   ├── services/      # Business logic services
│   │   ├── middleware/    # Express middleware
│   │   └── app.js        # Express application
│   ├── .env.example      # Environment variables template
│   └── package.json      # Backend dependencies
├── docs/                 # Documentation
├── setup.sh             # Automated setup script
└── package.json         # Root package.json with scripts
```

## 🔧 Development Scripts

Available npm scripts:

```bash
# Setup
npm run setup           # Run automated setup
npm run install:all     # Install all dependencies

# Development
npm run dev            # Start both backend and frontend
npm run dev:backend    # Start backend only
npm run dev:frontend   # Start frontend only

# Production
npm run start:backend  # Start backend in production
npm run start:frontend # Start frontend in production

# Testing
npm run test           # Run all tests
npm run test:backend   # Run backend tests
npm run test:frontend  # Run frontend tests

# Maintenance
npm run clean          # Clean all node_modules
npm run reset          # Clean and reinstall all dependencies
```

## 🔐 Security Architecture

PowerNOVA uses a secure backend-first architecture:

```
Frontend (React Native)
    ↓ Firebase ID Token
Backend API (Express.js)
    ↓ API Keys (secure)
OpenAI API / Pinecone / Firebase
```

- 🔒 **No API keys in frontend** - All sensitive keys are backend-only
- 🔐 **Authentication required** - Firebase ID token verification
- 🛡️ **Rate limiting** - Prevents API abuse
- 📊 **Usage monitoring** - Track API calls per user

## 📚 Key Features

- **🎤 Voice Input** - Speech-to-text with OpenAI Whisper
- **💬 AI Chat** - Powered by OpenAI GPT models
- **📄 Document Upload** - PDF, DOC, DOCX, TXT support
- **🔍 Vector Search** - Pinecone-powered document search
- **👤 User Authentication** - Google Sign-In with Firebase
- **💾 Data Persistence** - Firestore for conversations and documents
- **🔄 Real-time Updates** - Live conversation history
- **📱 Cross-platform** - iOS, Android, and Web support

## 🔧 Configuration

### Firebase Setup
1. Create a Firebase project
2. Enable Authentication with Google provider
3. Create Firestore database
4. Set up Storage bucket
5. Configure security rules (see `docs/` folder)

### Pinecone Setup
1. Create a Pinecone account
2. Create an index named 'powernova-docs'
3. Use dimension 1536 (OpenAI embeddings)
4. Use cosine similarity metric

### OpenAI Setup
1. Get an OpenAI API key
2. Ensure you have access to GPT and Whisper APIs

## 🐛 Troubleshooting

### Common Issues

**Backend won't start:**
- Check `.env` file exists and has all required variables
- Verify Firebase credentials are correct
- Ensure port 3001 is available

**Frontend can't connect to backend:**
- Check backend is running on port 3001
- Verify `BACKEND_API_URL` in App.js
- Check CORS settings in backend

**Authentication not working:**
- Verify Firebase config in `app/firebase.js`
- Check Google provider is enabled in Firebase Console
- Ensure domain is authorized in Firebase

**Document upload fails:**
- Check Firebase Storage rules
- Verify file size limits (25MB for audio, 10MB for documents)
- Ensure user is authenticated

## 📖 Documentation

For detailed documentation, see:
- `backend/README.md` - Backend setup and API documentation
- `docs/` folder - Setup guides and troubleshooting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review the setup scripts and documentation
3. Check the console logs for error messages
4. Open an issue on GitHub with detailed information

---

**Happy coding! 🚀**
