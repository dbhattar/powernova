"""
Chat routes - Handle chat completions with OpenAI streaming
"""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import json
import os
from openai import AsyncOpenAI
import asyncio

router = APIRouter()

# Initialize OpenAI client
openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    print("WARNING: OPENAI_API_KEY not found in environment variables")
    openai_client = None
else:
    openai_client = AsyncOpenAI(api_key=openai_api_key)

# Pydantic models for request/response validation
class Message(BaseModel):
    role: str = Field(..., description="Message role: 'user', 'assistant', or 'system'")
    content: str = Field(..., description="Message content")

class ChatRequest(BaseModel):
    messages: List[Message] = Field(..., description="List of chat messages")
    model: str = Field(default="gpt-4o-mini", description="OpenAI model to use")
    temperature: Optional[float] = Field(default=0.7, ge=0.0, le=2.0, description="Sampling temperature")
    max_tokens: Optional[int] = Field(default=2000, ge=1, le=4096, description="Maximum tokens to generate")
    stream: bool = Field(default=True, description="Whether to stream the response")

class ChatResponse(BaseModel):
    id: str
    content: str
    role: str = "assistant"
    model: str
    finish_reason: Optional[str] = None

@router.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """
    Stream chat completion from OpenAI
    
    This endpoint proxies requests to OpenAI's chat completion API
    and streams the response back to the client using Server-Sent Events (SSE).
    
    Returns:
        StreamingResponse: SSE stream of chat completion chunks
    """
    
    # Check if OpenAI client is initialized
    if not openai_client:
        raise HTTPException(
            status_code=500,
            detail="OpenAI API key not configured. Please set OPENAI_API_KEY environment variable."
        )
    
    # Validate that we have at least one message
    if not request.messages:
        raise HTTPException(
            status_code=400,
            detail="At least one message is required"
        )
    
    # Convert Pydantic models to dicts for OpenAI API
    messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]
    
    async def generate_stream():
        """
        Generator function that streams chat completions from OpenAI
        """
        try:
            # Create streaming chat completion
            stream = await openai_client.chat.completions.create(
                model=request.model,
                messages=messages,
                temperature=request.temperature,
                max_tokens=request.max_tokens,
                stream=True
            )
            
            # Stream each chunk to the client
            async for chunk in stream:
                if chunk.choices:
                    choice = chunk.choices[0]
                    
                    # Check if there's content to send
                    if choice.delta.content:
                        # Format as SSE (Server-Sent Events)
                        data = {
                            "id": chunk.id,
                            "content": choice.delta.content,
                            "role": "assistant",
                            "model": chunk.model,
                            "finish_reason": choice.finish_reason
                        }
                        yield f"data: {json.dumps(data)}\n\n"
                    
                    # Send finish signal
                    if choice.finish_reason:
                        data = {
                            "id": chunk.id,
                            "content": "",
                            "role": "assistant",
                            "model": chunk.model,
                            "finish_reason": choice.finish_reason,
                            "done": True
                        }
                        yield f"data: {json.dumps(data)}\n\n"
            
            # Send final done signal
            yield "data: [DONE]\n\n"
            
        except Exception as e:
            # Log error and send error message to client
            print(f"Error in chat stream: {str(e)}")
            error_data = {
                "error": str(e),
                "type": "stream_error"
            }
            yield f"data: {json.dumps(error_data)}\n\n"
    
    # Return streaming response with proper headers
    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable nginx buffering
        }
    )

@router.post("/chat")
async def chat_completion(request: ChatRequest):
    """
    Non-streaming chat completion endpoint
    
    For clients that prefer a single response instead of streaming.
    
    Returns:
        ChatResponse: Complete chat response
    """
    
    # Check if OpenAI client is initialized
    if not openai_client:
        raise HTTPException(
            status_code=500,
            detail="OpenAI API key not configured. Please set OPENAI_API_KEY environment variable."
        )
    
    # Validate that we have at least one message
    if not request.messages:
        raise HTTPException(
            status_code=400,
            detail="At least one message is required"
        )
    
    try:
        # Convert Pydantic models to dicts for OpenAI API
        messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]
        
        # Create chat completion (non-streaming)
        response = await openai_client.chat.completions.create(
            model=request.model,
            messages=messages,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            stream=False
        )
        
        # Extract response
        choice = response.choices[0]
        
        return ChatResponse(
            id=response.id,
            content=choice.message.content,
            role=choice.message.role,
            model=response.model,
            finish_reason=choice.finish_reason
        )
        
    except Exception as e:
        print(f"Error in chat completion: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error communicating with OpenAI: {str(e)}"
        )

# Health check for chat service
@router.get("/chat/health")
async def chat_health():
    """
    Check if OpenAI API is configured and accessible
    """
    if not openai_client:
        return {
            "status": "unhealthy",
            "message": "OpenAI API key not configured"
        }
    
    try:
        # Try to list models as a health check
        models = await openai_client.models.list()
        return {
            "status": "healthy",
            "message": "OpenAI API is accessible",
            "models_available": True
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "message": f"Cannot access OpenAI API: {str(e)}"
        }
