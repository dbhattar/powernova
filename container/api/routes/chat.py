"""
Chat routes - Handle chat completions with OpenAI streaming
"""
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import json
import os
from openai import AsyncOpenAI
import asyncio
from sqlalchemy.orm import Session

from database import get_db
from services.rag_service import get_rag_service
from services.conversation_service import get_conversation_service
from services.auth import get_current_user_optional
from models import User

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
    conversation_id: Optional[int] = Field(default=None, description="ID of the conversation to save messages to")
    model: str = Field(default="gpt-4o-mini", description="OpenAI model to use")
    temperature: Optional[float] = Field(default=0.7, ge=0.0, le=2.0, description="Sampling temperature")
    max_tokens: Optional[int] = Field(default=2000, ge=1, le=4096, description="Maximum tokens to generate")
    stream: bool = Field(default=True, description="Whether to stream the response")
    use_rag: bool = Field(default=True, description="Whether to use RAG for context")
    top_k: int = Field(default=5, description="Number of documents to retrieve for RAG")
    similarity_threshold: float = Field(default=0.5, ge=0.0, le=1.0, description="Minimum similarity for RAG documents")

class ChatResponse(BaseModel):
    id: str
    content: str
    role: str = "assistant"
    model: str
    finish_reason: Optional[str] = None

@router.post("/chat/stream")
async def chat_stream(
    request: ChatRequest, 
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Stream chat completion from OpenAI with optional RAG
    
    This endpoint proxies requests to OpenAI's chat completion API
    and streams the response back to the client using Server-Sent Events (SSE).
    
    Authentication is OPTIONAL - the endpoint works for both authenticated and anonymous users.
    
    If use_rag=True, retrieves relevant documents from the vector database
    and includes them as context in the system message.
    
    If conversation_id is provided and user is authenticated, saves messages to the database.
    
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
    
    # If conversation_id is provided, verify user owns it
    conv_service = None
    conversation = None
    if request.conversation_id and current_user:
        conv_service = get_conversation_service(db)
        conversation = conv_service.get_conversation(request.conversation_id, current_user.id)
        if not conversation:
            raise HTTPException(
                status_code=404,
                detail="Conversation not found or you don't have access to it"
            )
    
    # Convert Pydantic models to dicts for OpenAI API
    messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]
    
    # Retrieve relevant documents if RAG is enabled
    relevant_docs = []
    if request.use_rag:
        try:
            # Get the last user message as the query
            user_messages = [msg for msg in request.messages if msg.role == "user"]
            if user_messages:
                last_query = user_messages[-1].content
                
                # Search for relevant documents across hierarchy:
                # 1. Platform documents (crawled, available to all)
                # 2. User library documents (if user is authenticated)
                # 3. Conversation documents (if conversation_id provided)
                rag_service = get_rag_service(db)
                relevant_docs = rag_service.search_similar_documents(
                    query=last_query,
                    top_k=request.top_k,
                    similarity_threshold=request.similarity_threshold,
                    conversation_id=request.conversation_id if request.conversation_id else None,
                    user_id=current_user.id if current_user else None
                )
                
                # If we found relevant documents, add them to the system message
                if relevant_docs:
                    context_parts = []
                    for i, doc in enumerate(relevant_docs, 1):
                        context_parts.append(f"""
[Document {i}]
Title: {doc['title']}
URL: {doc['url']}
Similarity: {doc['similarity']:.2%}

{doc['content_full']}
                        """.strip())
                    
                    context = "\n\n---\n\n".join(context_parts)
                    
                    # Prepend system message with RAG context
                    rag_system_message = {
                        "role": "system",
                        "content": f"""You are a helpful assistant that answers questions based on the provided documents and your knowledge.

Use the documents below as your PRIMARY source of information. If the documents contain relevant information, cite them by mentioning the document title or URL. If the documents don't contain enough information, you can use your general knowledge but indicate that you're doing so.

Retrieved Documents:
{context}

Answer the user's question based on these documents first, then supplement with your knowledge if needed."""
                    }
                    
                    # Insert RAG system message at the beginning
                    messages = [rag_system_message] + messages
        except Exception as e:
            print(f"Error retrieving RAG context: {str(e)}")
            # Continue without RAG if there's an error
    
    async def generate_stream():
        """
        Generator function that streams chat completions from OpenAI
        """
        assistant_message_content = ""  # Collect full assistant response
        
        try:
            # Save user message to database if conversation_id is provided
            if conversation and conv_service and current_user:
                # Get the last user message
                user_messages = [msg for msg in request.messages if msg.role == "user"]
                if user_messages:
                    last_user_message = user_messages[-1].content
                    conv_service.add_message(
                        conversation_id=request.conversation_id,
                        user_id=current_user.id,
                        role="user",
                        content=last_user_message,
                        token_count=len(last_user_message.split())  # Rough estimate
                    )
            
            # Send sources first if we have them
            if relevant_docs:
                sources_data = {
                    "type": "sources",
                    "sources": [{
                        "title": doc['title'],
                        "url": doc['url'],
                        "similarity": doc['similarity']
                    } for doc in relevant_docs]
                }
                yield f"data: {json.dumps(sources_data)}\n\n"
            
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
                        # Accumulate content for database save
                        assistant_message_content += choice.delta.content
                        
                        # Format as SSE (Server-Sent Events)
                        data = {
                            "type": "content",
                            "id": chunk.id,
                            "content": choice.delta.content,
                            "role": "assistant",
                            "model": chunk.model,
                            "finish_reason": choice.finish_reason
                        }
                        yield f"data: {json.dumps(data)}\n\n"
                    
                    # Send finish signal
                    if choice.finish_reason:
                        # Save assistant message to database if conversation_id is provided
                        if conversation and conv_service and current_user and assistant_message_content:
                            conv_service.add_message(
                                conversation_id=request.conversation_id,
                                user_id=current_user.id,
                                role="assistant",
                                content=assistant_message_content,
                                model=chunk.model,
                                token_count=len(assistant_message_content.split())  # Rough estimate
                            )
                            
                            # Auto-generate title if this is the first exchange (2 messages)
                            if len(conversation.messages) == 2 and conversation.title == "New Conversation":
                                try:
                                    await conv_service.auto_generate_title(
                                        conversation_id=request.conversation_id,
                                        user_id=current_user.id
                                    )
                                except Exception as e:
                                    print(f"Error auto-generating title: {str(e)}")
                        
                        data = {
                            "type": "content",
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
                "type": "error",
                "error": str(e)
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


# Pydantic models for follow-up questions
class FollowUpQuestion(BaseModel):
    """Single follow-up question"""
    text: str = Field(..., description="The question text")
    icon: str = Field(..., description="Font Awesome icon class")


class FollowUpRequest(BaseModel):
    """Request model for generating follow-up questions"""
    messages: List[Message] = Field(..., description="Conversation history to generate questions from")
    count: int = Field(default=3, ge=1, le=5, description="Number of questions to generate")


class FollowUpResponse(BaseModel):
    """Response model for follow-up questions"""
    questions: List[FollowUpQuestion] = Field(..., description="List of follow-up questions")


@router.post("/chat/follow-up-questions", response_model=FollowUpResponse)
async def generate_follow_up_questions(request: FollowUpRequest):
    """
    Generate contextual follow-up questions based on conversation history
    
    This endpoint uses an LLM to analyze the conversation and suggest
    relevant follow-up questions for the user.
    
    Returns:
        FollowUpResponse: List of follow-up questions with icons
    """
    
    # Check if OpenAI client is initialized
    if not openai_client:
        raise HTTPException(
            status_code=500,
            detail="OpenAI API key not configured. Please set OPENAI_API_KEY environment variable."
        )
    
    # System prompt for generating follow-up questions
    system_prompt = """You are a helpful assistant that generates relevant follow-up questions for conversations about energy markets, regulations, and grid operations.

Based on the conversation context, generate exactly {count} relevant follow-up questions that the user might want to ask next. The questions should:
1. Be specific and actionable
2. Build upon the current conversation
3. Explore related topics or dive deeper into mentioned concepts
4. Be relevant to energy markets, CAISO, ERCOT, PJM, MISO, FERC regulations, or grid operations

Return ONLY a JSON array with exactly {count} objects, each with "text" and "icon" properties. Use Font Awesome icon classes.
Example format:
[
  {{"text": "What are the timeline requirements?", "icon": "fas fa-clock"}},
  {{"text": "How do costs compare across regions?", "icon": "fas fa-dollar-sign"}},
  {{"text": "What are the next steps in the process?", "icon": "fas fa-list-ol"}}
]

Available icon classes: fa-clock, fa-dollar-sign, fa-chart-line, fa-file-alt, fa-gavel, fa-industry, fa-bolt, fa-sun, fa-wind, fa-battery-full, fa-plug, fa-network-wired, fa-database, fa-info-circle, fa-list-ol, fa-calendar-alt, fa-tools, fa-shield-alt, fa-globe-americas, fa-exchange-alt, fa-balance-scale

IMPORTANT: Return ONLY the JSON array, no additional text or explanation."""
    
    # Format system prompt with count
    system_prompt = system_prompt.format(count=request.count)
    
    try:
        # Convert Pydantic messages to dict format
        conversation_messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]
        
        # Prepare messages for OpenAI
        messages = [
            {"role": "system", "content": system_prompt},
            *conversation_messages
        ]
        
        # Call OpenAI API
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.8,
            max_tokens=300,
            stream=False
        )
        
        # Extract response content
        content = response.choices[0].message.content
        
        # Parse JSON response
        try:
            # Extract JSON array from response (handle cases where LLM adds extra text)
            import re
            json_match = re.search(r'\[[\s\S]*\]', content)
            
            if json_match:
                questions_data = json.loads(json_match.group(0))
                
                # Validate and convert to FollowUpQuestion objects
                if isinstance(questions_data, list):
                    questions = []
                    for q in questions_data[:request.count]:
                        if isinstance(q, dict) and 'text' in q and 'icon' in q:
                            questions.append(FollowUpQuestion(text=q['text'], icon=q['icon']))
                    
                    if questions:
                        return FollowUpResponse(questions=questions)
            
            # If parsing fails, return fallback questions
            raise ValueError("Could not parse valid questions from response")
            
        except (json.JSONDecodeError, ValueError) as parse_error:
            print(f"Error parsing follow-up questions: {str(parse_error)}")
            print(f"Raw response: {content}")
            
            # Return fallback questions
            fallback_questions = [
                FollowUpQuestion(text="Can you provide more details on this topic?", icon="fas fa-info-circle"),
                FollowUpQuestion(text="What are the latest regulatory changes?", icon="fas fa-gavel"),
                FollowUpQuestion(text="How does this compare to other regions?", icon="fas fa-globe-americas")
            ]
            
            return FollowUpResponse(questions=fallback_questions[:request.count])
    
    except Exception as e:
        print(f"Error generating follow-up questions: {str(e)}")
        
        # Return fallback questions on error
        fallback_questions = [
            FollowUpQuestion(text="Can you provide more details on this topic?", icon="fas fa-info-circle"),
            FollowUpQuestion(text="What are the latest regulatory changes?", icon="fas fa-gavel"),
            FollowUpQuestion(text="How does this compare to other regions?", icon="fas fa-globe-americas")
        ]
        
        return FollowUpResponse(questions=fallback_questions[:request.count])
