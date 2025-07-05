# PowerNOVA Development Guide

## 🚀 Getting Started

### Super Quick Start
```bash
# One command to rule them all
./start.sh
```

### Step-by-Step Setup
```bash
# 1. Check your environment
./check-env.sh

# 2. Run full setup (first time only)
./setup.sh

# 3. Start development
./start.sh
```

## 🛠️ Development Workflow

### Daily Development
```bash
# Start both backend and frontend
npm run dev

# Or start individually
npm run dev:backend   # Port 3001
npm run dev:frontend  # Port 8081
```

### Common Commands
```bash
# Check environment
./check-env.sh

# Install dependencies
npm run install:all

# Clean everything and reinstall
npm run reset

# Run tests
npm run test

# Lint code
npm run lint
```

## 📱 Testing the App

### Frontend (Expo)
- **Web**: Opens automatically at http://localhost:8081
- **Mobile**: Scan QR code with Expo Go app
- **iOS Simulator**: Press `i` in terminal
- **Android Emulator**: Press `a` in terminal

### Backend API
- **Health Check**: http://localhost:3001/health
- **API Endpoints**: http://localhost:3001/api/*

## 🔧 Configuration

### Required Environment Variables

#### Backend (.env)
```bash
# OpenAI
OPENAI_API_KEY=sk-your-actual-key-here

# Pinecone
PINECONE_API_KEY=your-pinecone-key
PINECONE_ENVIRONMENT=us-east1-gcp
PINECONE_INDEX_NAME=powernova-docs

# Firebase Admin
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
```

#### Frontend (firebase.js)
```javascript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

## 🏗️ Architecture

### Frontend Architecture
```
App.js (Main component)
├── components/
│   ├── DocumentUpload.js
│   ├── DocumentManagement.js
│   ├── ConversationHistory.js
│   └── ProfilePicture.js
├── firebase.js (Firebase config)
└── documentService.js (Document handling)
```

### Backend Architecture
```
src/
├── app.js (Express server)
├── middleware/
│   └── authMiddleware.js (Firebase auth)
├── controllers/
│   ├── chatController.js
│   ├── documentController.js
│   └── vectorController.js
└── services/
    ├── openaiService.js
    ├── vectorService.js
    └── firebaseService.js
```

## 🔄 API Flow

```
Frontend → Firebase ID Token → Backend → OpenAI/Pinecone/Firebase
```

### Key API Endpoints
- `POST /api/chat/message` - Send chat message
- `POST /api/chat/transcribe` - Transcribe audio
- `GET /api/chat/history` - Get conversation history
- `POST /api/documents/upload` - Upload document
- `GET /api/documents` - List documents
- `DELETE /api/documents/:id` - Delete document

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test
```

### Frontend Tests
```bash
cd app
npm test
```

### Manual Testing Checklist
- [ ] User can sign in with Google
- [ ] Voice recording works
- [ ] Text input works
- [ ] Chat responses are received
- [ ] Document upload works
- [ ] Document deletion works
- [ ] Conversation history loads
- [ ] Follow-up questions work

## 🐛 Common Issues & Solutions

### Backend Issues

**Port 3001 already in use:**
```bash
# Kill existing process
lsof -ti:3001 | xargs kill -9
```

**Firebase auth errors:**
- Check Firebase credentials in `.env`
- Verify Firebase project settings
- Ensure service account has correct permissions

**OpenAI API errors:**
- Verify API key is correct
- Check OpenAI account has sufficient credits
- Ensure API key has correct permissions

### Frontend Issues

**Expo won't start:**
```bash
# Clear Expo cache
cd app
expo start --clear
```

**Firebase auth not working:**
- Check Firebase config in `firebase.js`
- Verify web domain is authorized in Firebase Console
- Check Google provider is enabled

**Backend connection failed:**
- Ensure backend is running on port 3001
- Check network connectivity
- Verify CORS settings in backend

## 📊 Monitoring & Debugging

### Backend Logs
```bash
# Watch backend logs
cd backend
npm run dev  # Shows real-time logs
```

### Frontend Logs
- Open browser dev tools for web
- Use React Native debugger for mobile
- Check Expo developer tools

### Database Monitoring
- **Firestore**: Firebase Console → Firestore Database
- **Storage**: Firebase Console → Storage
- **Pinecone**: Pinecone Console → Indexes

## 🚀 Deployment

### Backend Deployment
```bash
# Build for production
cd backend
npm run build

# Deploy to your platform (Heroku, Railway, etc.)
```

### Frontend Deployment
```bash
# Build for web
cd app
expo build:web

# Build for mobile
expo build:ios
expo build:android
```

## 📈 Performance Tips

### Backend Optimization
- Use connection pooling for databases
- Implement caching for frequent queries
- Optimize API response sizes
- Use compression middleware

### Frontend Optimization
- Implement lazy loading for components
- Optimize image sizes
- Use React.memo for expensive components
- Implement proper error boundaries

## 🔒 Security Best Practices

### Backend Security
- Always validate input data
- Use rate limiting
- Implement proper error handling
- Keep dependencies updated
- Use HTTPS in production

### Frontend Security
- Never store sensitive data in client
- Validate all user inputs
- Use secure storage for tokens
- Implement proper authentication checks

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm run test`
5. Commit changes: `git commit -m 'Add amazing feature'`
6. Push to branch: `git push origin feature/amazing-feature`
7. Submit a pull request

## 📚 Additional Resources

- [Expo Documentation](https://docs.expo.dev/)
- [Firebase Documentation](https://firebase.google.com/docs)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Pinecone Documentation](https://docs.pinecone.io/)
- [React Native Documentation](https://reactnative.dev/docs)

---

**Happy coding! 🎉**
