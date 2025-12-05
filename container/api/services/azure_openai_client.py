"""
Azure OpenAI Client Helper

This module provides helper functions to initialize OpenAI or Azure OpenAI clients
based on environment configuration. This allows easy switching between OpenAI and
Azure OpenAI without changing application code.

Environment Variables:
    USE_AZURE_OPENAI: Set to "true" to use Azure OpenAI, otherwise uses OpenAI
    
    For OpenAI:
        OPENAI_API_KEY: Your OpenAI API key
    
    For Azure OpenAI:
        AZURE_OPENAI_ENDPOINT: Your Azure OpenAI endpoint
        AZURE_OPENAI_API_KEY: Your Azure OpenAI API key
        AZURE_OPENAI_API_VERSION: API version (default: 2024-02-15-preview)
        AZURE_OPENAI_CHAT_DEPLOYMENT: Chat model deployment name
        AZURE_OPENAI_EMBEDDING_DEPLOYMENT: Embedding model deployment name

Usage:
    from services.azure_openai_client import (
        get_openai_client,
        get_async_openai_client,
        get_chat_model_name,
        get_embedding_model_name
    )
    
    # Sync client
    client = get_openai_client()
    response = client.chat.completions.create(
        model=get_chat_model_name(),
        messages=[...]
    )
    
    # Async client
    async_client = get_async_openai_client()
    response = await async_client.chat.completions.create(
        model=get_chat_model_name(),
        messages=[...]
    )
"""

import os
from typing import Union
from openai import OpenAI, AzureOpenAI, AsyncOpenAI, AsyncAzureOpenAI


def _use_azure() -> bool:
    """Check if Azure OpenAI should be used"""
    return os.getenv('USE_AZURE_OPENAI', 'false').lower() == 'true'


def get_openai_client() -> Union[OpenAI, AzureOpenAI]:
    """
    Get a synchronous OpenAI or Azure OpenAI client based on configuration.
    
    Returns:
        OpenAI or AzureOpenAI client instance
        
    Raises:
        ValueError: If required environment variables are not set
    """
    if _use_azure():
        # Azure OpenAI configuration
        endpoint = os.getenv('AZURE_OPENAI_ENDPOINT')
        api_key = os.getenv('AZURE_OPENAI_API_KEY')
        api_version = os.getenv('AZURE_OPENAI_API_VERSION', '2024-02-15-preview')
        
        if not endpoint or not api_key:
            raise ValueError(
                "Azure OpenAI is enabled but AZURE_OPENAI_ENDPOINT or "
                "AZURE_OPENAI_API_KEY is not set"
            )
        
        return AzureOpenAI(
            api_key=api_key,
            azure_endpoint=endpoint,
            api_version=api_version
        )
    else:
        # Standard OpenAI configuration
        api_key = os.getenv('OPENAI_API_KEY')
        
        if not api_key:
            raise ValueError("OPENAI_API_KEY is not set")
        
        return OpenAI(api_key=api_key)


def get_async_openai_client() -> Union[AsyncOpenAI, AsyncAzureOpenAI]:
    """
    Get an asynchronous OpenAI or Azure OpenAI client based on configuration.
    
    Returns:
        AsyncOpenAI or AsyncAzureOpenAI client instance
        
    Raises:
        ValueError: If required environment variables are not set
    """
    if _use_azure():
        # Azure OpenAI configuration
        endpoint = os.getenv('AZURE_OPENAI_ENDPOINT')
        api_key = os.getenv('AZURE_OPENAI_API_KEY')
        api_version = os.getenv('AZURE_OPENAI_API_VERSION', '2024-02-15-preview')
        
        if not endpoint or not api_key:
            raise ValueError(
                "Azure OpenAI is enabled but AZURE_OPENAI_ENDPOINT or "
                "AZURE_OPENAI_API_KEY is not set"
            )
        
        return AsyncAzureOpenAI(
            api_key=api_key,
            azure_endpoint=endpoint,
            api_version=api_version
        )
    else:
        # Standard OpenAI configuration
        api_key = os.getenv('OPENAI_API_KEY')
        
        if not api_key:
            raise ValueError("OPENAI_API_KEY is not set")
        
        return AsyncOpenAI(api_key=api_key)


def get_chat_model_name() -> str:
    """
    Get the appropriate chat model name based on configuration.
    
    For Azure OpenAI, returns the deployment name.
    For OpenAI, returns the model name (e.g., 'gpt-4o-mini').
    
    Returns:
        Model or deployment name to use for chat completions
        
    Raises:
        ValueError: If Azure deployment name is not set when using Azure
    """
    if _use_azure():
        deployment = os.getenv('AZURE_OPENAI_CHAT_DEPLOYMENT')
        if not deployment:
            raise ValueError(
                "Azure OpenAI is enabled but AZURE_OPENAI_CHAT_DEPLOYMENT is not set"
            )
        return deployment
    else:
        # For standard OpenAI, return the model name
        # This can be overridden in the request if needed
        return os.getenv('OPENAI_CHAT_MODEL', 'gpt-4o-mini')


def get_embedding_model_name() -> str:
    """
    Get the appropriate embedding model name based on configuration.
    
    For Azure OpenAI, returns the deployment name.
    For OpenAI, returns the model name (e.g., 'text-embedding-3-small').
    
    Returns:
        Model or deployment name to use for embeddings
        
    Raises:
        ValueError: If Azure deployment name is not set when using Azure
    """
    if _use_azure():
        deployment = os.getenv('AZURE_OPENAI_EMBEDDING_DEPLOYMENT')
        if not deployment:
            raise ValueError(
                "Azure OpenAI is enabled but AZURE_OPENAI_EMBEDDING_DEPLOYMENT is not set"
            )
        return deployment
    else:
        # For standard OpenAI, return the model name
        return os.getenv('OPENAI_EMBEDDING_MODEL', 'text-embedding-3-small')


# Convenience function for logging/debugging
def get_provider_info() -> dict:
    """
    Get information about the current OpenAI provider configuration.
    
    Returns:
        Dictionary with provider information
    """
    is_azure = _use_azure()
    
    info = {
        'provider': 'Azure OpenAI' if is_azure else 'OpenAI',
        'chat_model': get_chat_model_name(),
        'embedding_model': get_embedding_model_name()
    }
    
    if is_azure:
        info['endpoint'] = os.getenv('AZURE_OPENAI_ENDPOINT', 'Not set')
        info['api_version'] = os.getenv('AZURE_OPENAI_API_VERSION', '2024-02-15-preview')
    
    return info
