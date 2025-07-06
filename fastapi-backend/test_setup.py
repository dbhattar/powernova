"""
Simple test to verify FastAPI backend setup
Run with: python test_setup.py
"""

import sys
import importlib.util

def test_imports():
    """Test that all required packages can be imported"""
    required_packages = [
        'fastapi',
        'uvicorn',
        'sqlalchemy',
        'pydantic',
        'pydantic_settings'
    ]
    
    print("🧪 Testing package imports...")
    
    for package in required_packages:
        try:
            __import__(package)
            print(f"✅ {package} - OK")
        except ImportError as e:
            print(f"❌ {package} - FAILED: {e}")
            return False
    
    return True

def test_app_structure():
    """Test that app structure is correct"""
    import os
    
    print("\n🏗️  Testing app structure...")
    
    required_files = [
        'main.py',
        'requirements.txt',
        'app/__init__.py',
        'app/core/config.py',
        'app/models/database.py',
        'app/models/models.py',
        'app/models/schemas.py',
        'app/middleware/firebase_auth.py',
        'app/routes/auth.py',
        'app/routes/chat.py',
        'app/routes/documents.py',
        'app/routes/substations.py',
        'app/services/chat_service.py'
    ]
    
    for file_path in required_files:
        if os.path.exists(file_path):
            print(f"✅ {file_path} - EXISTS")
        else:
            print(f"❌ {file_path} - MISSING")
            return False
    
    return True

def test_basic_functionality():
    """Test basic app functionality"""
    print("\n⚙️  Testing basic functionality...")
    
    try:
        # Test configuration
        from app.core.config import settings
        print(f"✅ Configuration loaded - Environment: {settings.ENVIRONMENT}")
        
        # Test models import
        from app.models.models import User, Conversation, Document
        print("✅ Database models imported")
        
        # Test schemas import
        from app.models.schemas import UserResponse, ChatRequest
        print("✅ Pydantic schemas imported")
        
        return True
        
    except Exception as e:
        print(f"❌ Basic functionality test failed: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 PowerNOVA FastAPI Backend Setup Test\n")
    
    tests = [
        test_imports,
        test_app_structure,
        test_basic_functionality
    ]
    
    all_passed = True
    
    for test in tests:
        if not test():
            all_passed = False
    
    if all_passed:
        print("\n🎉 All tests passed! FastAPI backend is ready.")
        print("\n📝 Next steps:")
        print("1. Copy firebase-service-account.json to the project")
        print("2. Update .env file with your database connection")
        print("3. Run: python main.py")
        print("4. Visit: http://localhost:8001/docs")
    else:
        print("\n❌ Some tests failed. Please check the setup.")
        sys.exit(1)

if __name__ == "__main__":
    main()
