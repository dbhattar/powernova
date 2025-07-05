#!/bin/bash

# PowerNOVA Setup Script
# This script sets up both backend and frontend for development

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "\n${BLUE}=====================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}=====================================${NC}\n"
}

# Check if required tools are installed
check_requirements() {
    print_header "Checking Requirements"
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2)
    print_success "Node.js version: $NODE_VERSION"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm first."
        exit 1
    fi
    
    NPM_VERSION=$(npm --version)
    print_success "npm version: $NPM_VERSION"
    
    # Check if Expo CLI is installed
    if ! command -v expo &> /dev/null; then
        print_warning "Expo CLI not found. Installing globally..."
        npm install -g @expo/cli
    fi
    
    EXPO_VERSION=$(expo --version)
    print_success "Expo CLI version: $EXPO_VERSION"
}

# Setup backend
setup_backend() {
    print_header "Setting Up Backend"
    
    cd backend
    
    # Install dependencies
    print_status "Installing backend dependencies..."
    npm install
    
    # Create .env file if it doesn't exist
    if [ ! -f .env ]; then
        print_status "Creating .env file from example..."
        cp .env.example .env
        print_warning "Please edit backend/.env with your API keys and configuration"
        print_warning "Required variables:"
        echo "  - OPENAI_API_KEY"
        echo "  - PINECONE_API_KEY"
        echo "  - PINECONE_ENVIRONMENT"
        echo "  - PINECONE_INDEX_NAME"
        echo "  - FIREBASE_PROJECT_ID"
        echo "  - FIREBASE_PRIVATE_KEY"
        echo "  - FIREBASE_CLIENT_EMAIL"
    else
        print_success ".env file already exists"
    fi
    
    cd ..
    print_success "Backend setup complete!"
}

# Setup frontend
setup_frontend() {
    print_header "Setting Up Frontend"
    
    cd app
    
    # Install dependencies
    print_status "Installing frontend dependencies..."
    npm install
    
    # Check if app.json exists and has required configuration
    if [ ! -f app.json ]; then
        print_error "app.json not found. Please create app.json with Expo configuration."
        exit 1
    fi
    
    # Check if firebase config exists
    if [ ! -f firebase.js ]; then
        print_warning "firebase.js not found. Please create Firebase configuration file."
        print_warning "You'll need to add your Firebase config to app/firebase.js"
    fi
    
    cd ..
    print_success "Frontend setup complete!"
}

# Create development scripts
create_dev_scripts() {
    print_header "Creating Development Scripts"
    
    # Create start-backend script
    cat > start-backend.sh << 'EOF'
#!/bin/bash
echo "Starting PowerNOVA Backend..."
cd backend
npm run dev
EOF
    
    # Create start-frontend script
    cat > start-frontend.sh << 'EOF'
#!/bin/bash
echo "Starting PowerNOVA Frontend..."
cd app
expo start
EOF
    
    # Create start-all script
    cat > start-all.sh << 'EOF'
#!/bin/bash
echo "Starting PowerNOVA (Backend + Frontend)..."

# Function to cleanup background processes
cleanup() {
    echo "Stopping all processes..."
    jobs -p | xargs -r kill
    exit 0
}

# Trap Ctrl+C and call cleanup
trap cleanup SIGINT SIGTERM

# Start backend in background
echo "Starting backend..."
cd backend
npm run dev &
BACKEND_PID=$!

# Wait a bit for backend to start
sleep 3

# Start frontend in background
echo "Starting frontend..."
cd ../app
expo start &
FRONTEND_PID=$!

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
EOF
    
    # Make scripts executable
    chmod +x start-backend.sh start-frontend.sh start-all.sh
    
    print_success "Development scripts created:"
    print_success "  - start-backend.sh: Start backend only"
    print_success "  - start-frontend.sh: Start frontend only"
    print_success "  - start-all.sh: Start both backend and frontend"
}

# Create configuration templates
create_config_templates() {
    print_header "Creating Configuration Templates"
    
    # Create backend .env.example if it doesn't exist
    if [ ! -f backend/.env.example ]; then
        cat > backend/.env.example << 'EOF'
# Server Configuration
NODE_ENV=development
PORT=3001
CORS_ORIGIN=http://localhost:8081,http://localhost:19006

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here

# Pinecone Configuration
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_ENVIRONMENT=your-pinecone-environment
PINECONE_INDEX_NAME=powernova-docs

# Firebase Admin Configuration
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com

# Logging
LOG_LEVEL=info
EOF
        print_success "Created backend/.env.example"
    fi
    
    # Create app.json template if it doesn't exist
    if [ ! -f app/app.json ]; then
        cat > app/app.json << 'EOF'
{
  "expo": {
    "name": "PowerNOVA",
    "slug": "powernova",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "assetBundlePatterns": [
      "**/*"
    ],
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#FFFFFF"
      }
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "extra": {
      "mainHeading": "PowerNOVA",
      "backendUrl": "https://your-backend-url.com/api"
    }
  }
}
EOF
        print_success "Created app/app.json template"
    fi
    
    # Create Firebase config template
    if [ ! -f app/firebase.js ]; then
        cat > app/firebase.js << 'EOF'
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your Firebase config
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
EOF
        print_success "Created app/firebase.js template"
        print_warning "Please update app/firebase.js with your actual Firebase configuration"
    fi
}

# Print setup instructions
print_setup_instructions() {
    print_header "Setup Instructions"
    
    echo -e "${YELLOW}1. Backend Configuration:${NC}"
    echo "   - Edit backend/.env with your API keys"
    echo "   - Required: OPENAI_API_KEY, PINECONE_API_KEY"
    echo "   - Download Firebase service account key and save as backend/firebase-service-account.json"
    echo "   - Or set Firebase environment variables in backend/.env"
    echo ""
    
    echo -e "${YELLOW}2. Frontend Configuration:${NC}"
    echo "   - Update app/firebase.js with your Firebase config"
    echo "   - Update app/app.json with your backend URL for production"
    echo ""
    
    echo -e "${YELLOW}3. Firebase Setup:${NC}"
    echo "   - Enable Authentication with Google provider"
    echo "   - Create Firestore database"
    echo "   - Set up Storage bucket"
    echo "   - Configure security rules (see docs/ folder)"
    echo ""
    
    echo -e "${YELLOW}4. Pinecone Setup:${NC}"
    echo "   - Create a Pinecone index named 'powernova-docs'"
    echo "   - Use dimension 1536 (for OpenAI embeddings)"
    echo "   - Use cosine similarity metric"
    echo ""
    
    echo -e "${YELLOW}5. Start Development:${NC}"
    echo "   - Backend only: ./start-backend.sh"
    echo "   - Frontend only: ./start-frontend.sh"
    echo "   - Both: ./start-all.sh"
    echo ""
    
    echo -e "${GREEN}For detailed setup instructions, see:${NC}"
    echo "   - backend/README.md"
    echo "   - docs/ folder"
}

# Main setup function
main() {
    print_header "PowerNOVA Setup Script"
    
    # Check if we're in the right directory
    if [ ! -d "backend" ] || [ ! -d "app" ]; then
        print_error "This script must be run from the PowerNOVA root directory"
        print_error "Expected structure: backend/ and app/ directories"
        exit 1
    fi
    
    check_requirements
    setup_backend
    setup_frontend
    create_dev_scripts
    create_config_templates
    
    # Setup Firebase
    print_header "Firebase Service Account Setup"
    print_status "Checking Firebase configuration..."
    if [ -f "setup-firebase.sh" ]; then
        ./setup-firebase.sh
    else
        print_warning "Firebase setup script not found"
    fi
    
    print_setup_instructions
    
    print_success "Setup complete! 🎉"
    print_status "Next steps:"
    echo "1. Configure your API keys in backend/.env"
    echo "2. Update Firebase config in app/firebase.js"
    echo "3. Run ./start-all.sh to start development"
}

# Run main function
main "$@"
