#!/usr/bin/env python3
"""
Azure OpenAI Deployment Test Script

This script tests your Azure OpenAI deployments to ensure:
1. Chat completion (GPT-4o-mini) is working
2. Embeddings (text-embedding-3-small) are working
3. Streaming chat is working
4. Error handling is correct

Usage:
    python test_azure_openai.py

Requirements:
    pip install openai python-dotenv
"""

import os
import sys
import asyncio
from typing import List, Dict, Any
from dotenv import load_dotenv
from openai import AzureOpenAI, AsyncAzureOpenAI

# Load environment variables
load_dotenv()

# Color codes for terminal output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_header(text: str):
    """Print a formatted header"""
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*70}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{text}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*70}{Colors.END}\n")

def print_success(text: str):
    """Print success message"""
    print(f"{Colors.GREEN}✓ {text}{Colors.END}")

def print_error(text: str):
    """Print error message"""
    print(f"{Colors.RED}✗ {text}{Colors.END}")

def print_info(text: str):
    """Print info message"""
    print(f"{Colors.YELLOW}ℹ {text}{Colors.END}")

def print_result(key: str, value: Any):
    """Print a key-value result"""
    print(f"  {Colors.BOLD}{key}:{Colors.END} {value}")

def get_config() -> Dict[str, str]:
    """
    Get Azure OpenAI configuration from environment variables
    
    Returns:
        Dict with configuration values
    """
    config = {
        'endpoint': os.getenv('AZURE_OPENAI_ENDPOINT'),
        'api_key': os.getenv('AZURE_OPENAI_API_KEY'),
        'api_version': os.getenv('AZURE_OPENAI_API_VERSION', '2024-02-15-preview'),
        'chat_deployment': os.getenv('AZURE_OPENAI_CHAT_DEPLOYMENT'),
        'embedding_deployment': os.getenv('AZURE_OPENAI_EMBEDDING_DEPLOYMENT'),
    }
    
    return config

def validate_config(config: Dict[str, str]) -> bool:
    """
    Validate that all required configuration is present
    
    Args:
        config: Configuration dictionary
        
    Returns:
        True if valid, False otherwise
    """
    print_header("Configuration Validation")
    
    required_fields = [
        ('endpoint', 'AZURE_OPENAI_ENDPOINT'),
        ('api_key', 'AZURE_OPENAI_API_KEY'),
        ('chat_deployment', 'AZURE_OPENAI_CHAT_DEPLOYMENT'),
        ('embedding_deployment', 'AZURE_OPENAI_EMBEDDING_DEPLOYMENT'),
    ]
    
    all_valid = True
    
    for field, env_var in required_fields:
        value = config.get(field)
        if value:
            # Mask API key for security
            display_value = value if field != 'api_key' else f"{value[:10]}...{value[-4:]}"
            print_success(f"{env_var}: {display_value}")
        else:
            print_error(f"{env_var}: NOT SET")
            all_valid = False
    
    print_result("API Version", config.get('api_version'))
    
    if not all_valid:
        print_error("\nConfiguration validation failed!")
        print_info("Please set the missing environment variables in your .env file")
        return False
    
    print_success("\nConfiguration validation passed!")
    return True

def test_chat_completion(config: Dict[str, str]) -> bool:
    """
    Test chat completion with Azure OpenAI
    
    Args:
        config: Configuration dictionary
        
    Returns:
        True if test passed, False otherwise
    """
    print_header("Test 1: Chat Completion (Non-Streaming)")
    
    try:
        # Initialize client
        client = AzureOpenAI(
            api_key=config['api_key'],
            azure_endpoint=config['endpoint'],
            api_version=config['api_version']
        )
        
        print_info(f"Testing deployment: {config['chat_deployment']}")
        
        # Create chat completion
        response = client.chat.completions.create(
            model=config['chat_deployment'],
            messages=[
                {"role": "system", "content": "You are a helpful assistant. Keep responses brief."},
                {"role": "user", "content": "Say 'Hello from Azure OpenAI!' and nothing else."}
            ],
            temperature=0.7,
            max_tokens=50
        )
        
        # Extract response
        message = response.choices[0].message.content
        finish_reason = response.choices[0].finish_reason
        
        # Display results
        print_success("Chat completion successful!")
        print_result("Model", response.model)
        print_result("Finish Reason", finish_reason)
        print_result("Response", message)
        print_result("Total Tokens", response.usage.total_tokens)
        print_result("Prompt Tokens", response.usage.prompt_tokens)
        print_result("Completion Tokens", response.usage.completion_tokens)
        
        return True
        
    except Exception as e:
        print_error(f"Chat completion failed: {str(e)}")
        print_info(f"Error type: {type(e).__name__}")
        return False

async def test_chat_streaming(config: Dict[str, str]) -> bool:
    """
    Test streaming chat completion with Azure OpenAI
    
    Args:
        config: Configuration dictionary
        
    Returns:
        True if test passed, False otherwise
    """
    print_header("Test 2: Chat Completion (Streaming)")
    
    try:
        # Initialize async client
        client = AsyncAzureOpenAI(
            api_key=config['api_key'],
            azure_endpoint=config['endpoint'],
            api_version=config['api_version']
        )
        
        print_info(f"Testing deployment: {config['chat_deployment']}")
        
        # Create streaming chat completion
        stream = await client.chat.completions.create(
            model=config['chat_deployment'],
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Count from 1 to 5, one number per line."}
            ],
            temperature=0.7,
            max_tokens=100,
            stream=True
        )
        
        # Collect streamed response
        full_response = ""
        chunk_count = 0
        
        print_info("Streaming response:")
        print("  ", end="", flush=True)
        
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                content = chunk.choices[0].delta.content
                full_response += content
                print(content, end="", flush=True)
                chunk_count += 1
        
        print()  # New line after streaming
        
        # Display results
        print_success("Streaming chat completion successful!")
        print_result("Chunks Received", chunk_count)
        print_result("Full Response Length", len(full_response))
        
        return True
        
    except Exception as e:
        print_error(f"Streaming chat completion failed: {str(e)}")
        print_info(f"Error type: {type(e).__name__}")
        return False

def test_embeddings(config: Dict[str, str]) -> bool:
    """
    Test embeddings generation with Azure OpenAI
    
    Args:
        config: Configuration dictionary
        
    Returns:
        True if test passed, False otherwise
    """
    print_header("Test 3: Embeddings Generation")
    
    try:
        # Initialize client
        client = AzureOpenAI(
            api_key=config['api_key'],
            azure_endpoint=config['endpoint'],
            api_version=config['api_version']
        )
        
        print_info(f"Testing deployment: {config['embedding_deployment']}")
        
        # Test texts
        test_texts = [
            "Azure OpenAI provides powerful AI capabilities.",
            "Embeddings convert text into numerical vectors.",
            "This is a test of the embedding model."
        ]
        
        print_info(f"Generating embeddings for {len(test_texts)} texts...")
        
        # Create embeddings
        response = client.embeddings.create(
            model=config['embedding_deployment'],
            input=test_texts
        )
        
        # Display results
        print_success("Embeddings generation successful!")
        print_result("Model", response.model)
        print_result("Number of Embeddings", len(response.data))
        print_result("Embedding Dimensions", len(response.data[0].embedding))
        print_result("Total Tokens", response.usage.total_tokens)
        
        # Verify embedding properties
        for i, embedding_obj in enumerate(response.data):
            embedding = embedding_obj.embedding
            print_result(f"Embedding {i+1} Length", len(embedding))
            print_result(f"Embedding {i+1} Sample (first 5)", embedding[:5])
        
        return True
        
    except Exception as e:
        print_error(f"Embeddings generation failed: {str(e)}")
        print_info(f"Error type: {type(e).__name__}")
        return False

def test_batch_embeddings(config: Dict[str, str]) -> bool:
    """
    Test batch embeddings generation (larger batch)
    
    Args:
        config: Configuration dictionary
        
    Returns:
        True if test passed, False otherwise
    """
    print_header("Test 4: Batch Embeddings (10 texts)")
    
    try:
        # Initialize client
        client = AzureOpenAI(
            api_key=config['api_key'],
            azure_endpoint=config['endpoint'],
            api_version=config['api_version']
        )
        
        print_info(f"Testing deployment: {config['embedding_deployment']}")
        
        # Generate 10 test texts
        test_texts = [
            f"This is test document number {i+1} for batch embedding testing."
            for i in range(10)
        ]
        
        print_info(f"Generating embeddings for {len(test_texts)} texts in batch...")
        
        # Create embeddings
        response = client.embeddings.create(
            model=config['embedding_deployment'],
            input=test_texts
        )
        
        # Display results
        print_success("Batch embeddings generation successful!")
        print_result("Number of Embeddings", len(response.data))
        print_result("Total Tokens", response.usage.total_tokens)
        print_result("Avg Tokens per Text", response.usage.total_tokens / len(test_texts))
        
        return True
        
    except Exception as e:
        print_error(f"Batch embeddings generation failed: {str(e)}")
        print_info(f"Error type: {type(e).__name__}")
        return False

def test_error_handling(config: Dict[str, str]) -> bool:
    """
    Test error handling with invalid requests
    
    Args:
        config: Configuration dictionary
        
    Returns:
        True if error handling works correctly
    """
    print_header("Test 5: Error Handling")
    
    try:
        # Initialize client
        client = AzureOpenAI(
            api_key=config['api_key'],
            azure_endpoint=config['endpoint'],
            api_version=config['api_version']
        )
        
        print_info("Testing with invalid model deployment name...")
        
        # Try to use a non-existent deployment
        try:
            response = client.chat.completions.create(
                model="non-existent-deployment",
                messages=[{"role": "user", "content": "test"}]
            )
            print_error("Expected an error but request succeeded!")
            return False
        except Exception as e:
            print_success(f"Error correctly caught: {type(e).__name__}")
            print_result("Error Message", str(e)[:100])
        
        print_info("\nTesting with empty messages...")
        
        # Try with empty messages
        try:
            response = client.chat.completions.create(
                model=config['chat_deployment'],
                messages=[]
            )
            print_error("Expected an error but request succeeded!")
            return False
        except Exception as e:
            print_success(f"Error correctly caught: {type(e).__name__}")
            print_result("Error Message", str(e)[:100])
        
        print_success("\nError handling working correctly!")
        return True
        
    except Exception as e:
        print_error(f"Unexpected error in error handling test: {str(e)}")
        return False

async def run_all_tests():
    """Run all tests and display summary"""
    print_header("Azure OpenAI Deployment Testing")
    print(f"{Colors.BOLD}Testing Azure OpenAI chat and embedding deployments{Colors.END}\n")
    
    # Get configuration
    config = get_config()
    
    # Validate configuration
    if not validate_config(config):
        print_error("\n❌ Tests aborted due to configuration errors")
        sys.exit(1)
    
    # Run tests
    results = {}
    
    # Test 1: Chat completion
    results['chat_completion'] = test_chat_completion(config)
    
    # Test 2: Streaming chat
    results['streaming_chat'] = await test_chat_streaming(config)
    
    # Test 3: Embeddings
    results['embeddings'] = test_embeddings(config)
    
    # Test 4: Batch embeddings
    results['batch_embeddings'] = test_batch_embeddings(config)
    
    # Test 5: Error handling
    results['error_handling'] = test_error_handling(config)
    
    # Print summary
    print_header("Test Summary")
    
    total_tests = len(results)
    passed_tests = sum(1 for result in results.values() if result)
    failed_tests = total_tests - passed_tests
    
    for test_name, result in results.items():
        status = f"{Colors.GREEN}PASSED{Colors.END}" if result else f"{Colors.RED}FAILED{Colors.END}"
        print(f"  {test_name.replace('_', ' ').title()}: {status}")
    
    print(f"\n{Colors.BOLD}Total:{Colors.END} {total_tests} tests")
    print(f"{Colors.GREEN}{Colors.BOLD}Passed:{Colors.END} {passed_tests}")
    print(f"{Colors.RED}{Colors.BOLD}Failed:{Colors.END} {failed_tests}")
    
    if passed_tests == total_tests:
        print(f"\n{Colors.GREEN}{Colors.BOLD}🎉 All tests passed! Your Azure OpenAI deployments are working correctly.{Colors.END}")
        return 0
    else:
        print(f"\n{Colors.RED}{Colors.BOLD}❌ Some tests failed. Please check the errors above.{Colors.END}")
        return 1

def main():
    """Main entry point"""
    try:
        exit_code = asyncio.run(run_all_tests())
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print(f"\n\n{Colors.YELLOW}Tests interrupted by user{Colors.END}")
        sys.exit(1)
    except Exception as e:
        print_error(f"Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
