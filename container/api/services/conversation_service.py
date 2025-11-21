"""
Conversation Service - Business logic for managing conversations and messages
"""
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional, Dict, Any
from datetime import datetime

from models import Conversation, Message, ConversationDocument, Document, User
from models.conversation import MessageRole
import os
from openai import AsyncOpenAI

# Initialize OpenAI client for title generation
openai_api_key = os.getenv("OPENAI_API_KEY")
openai_client = AsyncOpenAI(api_key=openai_api_key) if openai_api_key else None


class ConversationService:
    """Service class for conversation management"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_conversation(self, user_id: int, title: str = "New Conversation") -> Conversation:
        """
        Create a new conversation for a user
        
        Args:
            user_id: ID of the user creating the conversation
            title: Optional title for the conversation
            
        Returns:
            Conversation: The created conversation object
        """
        conversation = Conversation(
            user_id=user_id,
            title=title
        )
        self.db.add(conversation)
        self.db.commit()
        self.db.refresh(conversation)
        return conversation
    
    def get_user_conversations(
        self, 
        user_id: int, 
        limit: int = 50, 
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Get all conversations for a user, ordered by most recent
        
        Args:
            user_id: ID of the user
            limit: Maximum number of conversations to return
            offset: Number of conversations to skip
            
        Returns:
            List of conversation dictionaries with metadata
        """
        conversations = (
            self.db.query(Conversation)
            .filter(Conversation.user_id == user_id)
            .order_by(desc(Conversation.updated_at))
            .limit(limit)
            .offset(offset)
            .all()
        )
        
        result = []
        for conv in conversations:
            # Get message count and last message preview
            messages = conv.messages
            message_count = len(messages)
            last_message = messages[-1] if messages else None
            
            # Get document count
            document_count = len(conv.conversation_documents)
            
            result.append({
                "id": conv.id,
                "title": conv.title,
                "created_at": conv.created_at.isoformat(),
                "updated_at": conv.updated_at.isoformat(),
                "message_count": message_count,
                "document_count": document_count,
                "last_message_preview": last_message.content[:100] if last_message else None,
                "last_message_role": last_message.role.value if last_message else None
            })
        
        return result
    
    def get_conversation(self, conversation_id: int, user_id: int) -> Optional[Conversation]:
        """
        Get a specific conversation with authorization check
        
        Args:
            conversation_id: ID of the conversation
            user_id: ID of the user (for authorization)
            
        Returns:
            Conversation object or None if not found/unauthorized
        """
        conversation = (
            self.db.query(Conversation)
            .filter(
                Conversation.id == conversation_id,
                Conversation.user_id == user_id
            )
            .first()
        )
        return conversation
    
    def get_conversation_messages(
        self, 
        conversation_id: int, 
        user_id: int,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Get all messages in a conversation
        
        Args:
            conversation_id: ID of the conversation
            user_id: ID of the user (for authorization)
            limit: Maximum number of messages to return
            offset: Number of messages to skip
            
        Returns:
            List of message dictionaries
        """
        # Verify user owns the conversation
        conversation = self.get_conversation(conversation_id, user_id)
        if not conversation:
            return []
        
        messages = (
            self.db.query(Message)
            .filter(Message.conversation_id == conversation_id)
            .order_by(Message.created_at)
            .limit(limit)
            .offset(offset)
            .all()
        )
        
        return [
            {
                "id": msg.id,
                "role": msg.role.value,
                "content": msg.content,
                "model": msg.model,
                "token_count": msg.token_count,
                "created_at": msg.created_at.isoformat(),
                "updated_at": msg.updated_at.isoformat()
            }
            for msg in messages
        ]
    
    def add_message(
        self,
        conversation_id: int,
        user_id: int,
        role: str,
        content: str,
        model: Optional[str] = None,
        token_count: int = 0
    ) -> Optional[Message]:
        """
        Add a message to a conversation
        
        Args:
            conversation_id: ID of the conversation
            user_id: ID of the user (for authorization)
            role: Message role (user, assistant, system)
            content: Message content
            model: AI model used (for assistant messages)
            token_count: Number of tokens in the message
            
        Returns:
            Message object or None if conversation not found/unauthorized
        """
        # Verify user owns the conversation
        conversation = self.get_conversation(conversation_id, user_id)
        if not conversation:
            return None
        
        # Convert string role to MessageRole enum
        try:
            message_role = MessageRole(role.lower())
        except ValueError:
            message_role = MessageRole.USER
        
        message = Message(
            conversation_id=conversation_id,
            role=message_role,
            content=content,
            model=model,
            token_count=token_count
        )
        
        self.db.add(message)
        
        # Update conversation's updated_at timestamp
        conversation.updated_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(message)
        
        return message
    
    def update_conversation_title(
        self,
        conversation_id: int,
        user_id: int,
        title: str
    ) -> Optional[Conversation]:
        """
        Update a conversation's title
        
        Args:
            conversation_id: ID of the conversation
            user_id: ID of the user (for authorization)
            title: New title for the conversation
            
        Returns:
            Updated conversation or None if not found/unauthorized
        """
        conversation = self.get_conversation(conversation_id, user_id)
        if not conversation:
            return None
        
        conversation.title = title
        conversation.updated_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(conversation)
        
        return conversation
    
    async def auto_generate_title(
        self,
        conversation_id: int,
        user_id: int
    ) -> Optional[str]:
        """
        Auto-generate a conversation title based on the first few messages
        
        Args:
            conversation_id: ID of the conversation
            user_id: ID of the user (for authorization)
            
        Returns:
            Generated title or None if failed
        """
        if not openai_client:
            return None
        
        # Get the conversation
        conversation = self.get_conversation(conversation_id, user_id)
        if not conversation:
            return None
        
        # Get first few messages
        messages = conversation.messages[:3]  # Use first 3 messages for context
        if not messages:
            return None
        
        # Build context for title generation
        context = "\n".join([f"{msg.role.value}: {msg.content}" for msg in messages])
        
        try:
            # Call OpenAI to generate title
            response = await openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a helpful assistant that generates concise, descriptive titles for conversations. Generate a title that is 3-8 words long, capturing the main topic. Return ONLY the title, no quotes or extra text."
                    },
                    {
                        "role": "user",
                        "content": f"Generate a short title for this conversation:\n\n{context}"
                    }
                ],
                temperature=0.7,
                max_tokens=50
            )
            
            title = response.choices[0].message.content.strip()
            
            # Remove quotes if present
            title = title.strip('"\'')
            
            # Limit title length
            if len(title) > 100:
                title = title[:97] + "..."
            
            # Update the conversation title
            conversation.title = title
            conversation.updated_at = datetime.utcnow()
            self.db.commit()
            
            return title
            
        except Exception as e:
            print(f"Error generating title: {str(e)}")
            return None
    
    def delete_conversation(
        self,
        conversation_id: int,
        user_id: int
    ) -> bool:
        """
        Delete a conversation and all its messages
        
        Args:
            conversation_id: ID of the conversation
            user_id: ID of the user (for authorization)
            
        Returns:
            True if deleted, False if not found/unauthorized
        """
        conversation = self.get_conversation(conversation_id, user_id)
        if not conversation:
            return False
        
        # Delete will cascade to messages and conversation_documents
        self.db.delete(conversation)
        self.db.commit()
        
        return True
    
    def add_document_to_conversation(
        self,
        conversation_id: int,
        document_id: int,
        user_id: int
    ) -> Optional[ConversationDocument]:
        """
        Link a document to a conversation
        
        Args:
            conversation_id: ID of the conversation
            document_id: ID of the document
            user_id: ID of the user (for authorization)
            
        Returns:
            ConversationDocument object or None if failed
        """
        # Verify user owns the conversation
        conversation = self.get_conversation(conversation_id, user_id)
        if not conversation:
            return None
        
        # Verify document exists
        document = self.db.query(Document).filter(Document.id == document_id).first()
        if not document:
            return None
        
        # Check if link already exists
        existing_link = (
            self.db.query(ConversationDocument)
            .filter(
                ConversationDocument.conversation_id == conversation_id,
                ConversationDocument.document_id == document_id
            )
            .first()
        )
        
        if existing_link:
            return existing_link
        
        # Create new link
        conv_doc = ConversationDocument(
            conversation_id=conversation_id,
            document_id=document_id,
            uploaded_by=user_id
        )
        
        self.db.add(conv_doc)
        self.db.commit()
        self.db.refresh(conv_doc)
        
        return conv_doc
    
    def get_conversation_documents(
        self,
        conversation_id: int,
        user_id: int
    ) -> List[Dict[str, Any]]:
        """
        Get all documents linked to a conversation
        
        Args:
            conversation_id: ID of the conversation
            user_id: ID of the user (for authorization)
            
        Returns:
            List of document dictionaries
        """
        # Verify user owns the conversation
        conversation = self.get_conversation(conversation_id, user_id)
        if not conversation:
            return []
        
        conv_docs = (
            self.db.query(ConversationDocument)
            .filter(ConversationDocument.conversation_id == conversation_id)
            .all()
        )
        
        result = []
        for conv_doc in conv_docs:
            doc = conv_doc.document
            result.append({
                "id": doc.id,
                "title": doc.title,
                "url": doc.url,
                "document_type": doc.document_type.value,
                "file_size": doc.file_size,
                "blob_url": doc.blob_url,
                "status": doc.status.value,
                "chunk_count": doc.chunk_count,
                "uploaded_at": conv_doc.created_at.isoformat(),
                "uploaded_by": conv_doc.uploaded_by
            })
        
        return result
    
    def remove_document_from_conversation(
        self,
        conversation_id: int,
        document_id: int,
        user_id: int
    ) -> bool:
        """
        Remove a document link from a conversation
        
        Args:
            conversation_id: ID of the conversation
            document_id: ID of the document
            user_id: ID of the user (for authorization)
            
        Returns:
            True if removed, False if not found/unauthorized
        """
        # Verify user owns the conversation
        conversation = self.get_conversation(conversation_id, user_id)
        if not conversation:
            return False
        
        # Find and delete the link
        conv_doc = (
            self.db.query(ConversationDocument)
            .filter(
                ConversationDocument.conversation_id == conversation_id,
                ConversationDocument.document_id == document_id
            )
            .first()
        )
        
        if not conv_doc:
            return False
        
        self.db.delete(conv_doc)
        self.db.commit()
        
        return True


def get_conversation_service(db: Session) -> ConversationService:
    """Factory function to get a ConversationService instance"""
    return ConversationService(db)
