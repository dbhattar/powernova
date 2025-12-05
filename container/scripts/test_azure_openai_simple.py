#!/usr/bin/env python3
"""
Quick Azure OpenAI Test Script

A simple, standalone script to quickly verify Azure OpenAI deployments.
No dependencies on PowerNOVA codebase required.

Usage:
    # Set environment variables or create .env file
    export AZURE_OPENAI_ENDPOINT="https://YOUR_RESOURCE.openai.azure.com/"
    export AZURE_OPENAI_API_KEY="your-api-key"
    export AZURE_OPENAI_CHAT_DEPLOYMENT="gpt-4o-mini-deployment"
    export AZURE_OPENAI_EMBEDDING_DEPLOYMENT="text-embedding-3-small-deployment"
    
    # Run the script
    python test_azure_openai_simple.py
"""

import os
import sys

def check_imports():
    """Check if required packages are installed"""
    try:
        from openai import AzureOpenAI
        print("✓ openai package found")
        return True
    except ImportError:
        print("✗ openai package not found")
        print("\nPlease install required packages:")
        print("  pip install openai python-dotenv")
        return False

if not check_imports():
    sys.exit(1)

from openai import AzureOpenAI

# Try to load .env file if python-dotenv is available
# try:
#     from dotenv import load_dotenv
#     load_dotenv()
#     print("✓ Loaded .env file")
# except ImportError:
#     print("ℹ python-dotenv not installed, using environment variables only")

def main():
    print("\n" + "="*70)
    print("Azure OpenAI Deployment Test")
    print("="*70 + "\n")
    
    # Get configuration
    endpoint = os.getenv('AZURE_OPENAI_ENDPOINT')
    api_key = os.getenv('AZURE_OPENAI_API_KEY')
    api_version = os.getenv('AZURE_OPENAI_API_VERSION', '2024-02-15-preview')
    chat_deployment = os.getenv('AZURE_OPENAI_CHAT_DEPLOYMENT')
    embedding_deployment = os.getenv('AZURE_OPENAI_EMBEDDING_DEPLOYMENT')
    
    # Validate configuration
    print("Configuration Check:")
    configs = [
        ("AZURE_OPENAI_ENDPOINT", endpoint),
        ("AZURE_OPENAI_API_KEY", api_key),
        ("AZURE_OPENAI_CHAT_DEPLOYMENT", chat_deployment),
        ("AZURE_OPENAI_EMBEDDING_DEPLOYMENT", embedding_deployment),
    ]
    
    missing = []
    for name, value in configs:
        if value:
            display = value if name != 'AZURE_OPENAI_API_KEY' else f"{value[:10]}...{value[-4:]}"
            print(f"  ✓ {name}: {display}")
        else:
            print(f"  ✗ {name}: NOT SET")
            missing.append(name)
    
    if missing:
        print(f"\n✗ Missing required environment variables: {', '.join(missing)}")
        print("\nPlease set them in your environment or .env file")
        sys.exit(1)
    
    print(f"\n{'='*70}\n")
    
    # Initialize client
    try:
        client = AzureOpenAI(
            api_key=api_key,
            azure_endpoint=endpoint,
            api_version=api_version
        )
        print("✓ Azure OpenAI client initialized\n")
    except Exception as e:
        print(f"✗ Failed to initialize client: {e}")
        sys.exit(1)
    
    # Test 1: Chat Completion
    print("Test 1: Chat Completion (GPT-4o-mini)")
    print("-" * 70)
    try:
        response = client.chat.completions.create(
            model=chat_deployment,
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Say 'Hello from Azure OpenAI!' and nothing else."}
            ],
            max_tokens=50
        )
        
        message = response.choices[0].message.content
        print(f"✓ Chat completion successful!")
        print(f"  Response: {message}")
        print(f"  Model: {response.model}")
        print(f"  Tokens: {response.usage.total_tokens} (prompt: {response.usage.prompt_tokens}, completion: {response.usage.completion_tokens})")
        test1_passed = True
    except Exception as e:
        print(f"✗ Chat completion failed: {e}")
        test1_passed = False
    
    print(f"\n{'='*70}\n")
    
    # Test 2: Embeddings
    print("Test 2: Text Embeddings")
    print("-" * 70)
    try:
        response = client.embeddings.create(
            model=embedding_deployment,
            input=["This is a test", "Azure OpenAI embeddings", "Vector database"]
        )
        
        print(f"✓ Embeddings generation successful!")
        print(f"  Model: {response.model}")
        print(f"  Number of embeddings: {len(response.data)}")
        print(f"  Dimensions: {len(response.data[0].embedding)}")
        print(f"  Tokens used: {response.usage.total_tokens}")
        print(f"  Sample embedding (first 5 values): {response.data[0].embedding[:5]}")
        test2_passed = True
    except Exception as e:
        print(f"✗ Embeddings generation failed: {e}")
        test2_passed = False
    
    print(f"\n{'='*70}\n")
    
    # Summary
    print("Test Summary:")
    print("-" * 70)
    print(f"  Chat Completion: {'✓ PASSED' if test1_passed else '✗ FAILED'}")
    print(f"  Embeddings: {'✓ PASSED' if test2_passed else '✗ FAILED'}")
    
    if test1_passed and test2_passed:
        print(f"\n🎉 All tests passed! Your Azure OpenAI deployments are working correctly.\n")
        return 0
    else:
        print(f"\n❌ Some tests failed. Please check your deployment configuration.\n")
        return 1

if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n\nTests interrupted by user")
        sys.exit(1)
