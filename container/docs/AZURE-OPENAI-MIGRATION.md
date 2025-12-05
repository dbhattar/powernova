# Migrating from OpenAI to Azure OpenAI

## Overview
This guide provides a complete plan to migrate PowerNOVA's API service from OpenAI to Azure OpenAI. Azure OpenAI provides the same models with enterprise-grade features, regional deployment, and compliance benefits.

## Current OpenAI Usage

### Files Using OpenAI
1. **`api/routes/chat.py`** - Chat streaming endpoint
   - Chat completions with streaming
   - Message history management
   - Conversation title generation (via conversation_service)

2. **`api/services/embedding_service.py`** - Vector embeddings
   - Text embeddings using `text-embedding-3-small`
   - Batch embedding generation
   - Token counting with tiktoken

3. **`api/services/conversation_service.py`** - Conversation management
   - Auto-generate conversation titles using GPT-4o-mini
   - Async OpenAI client

### Current Models Used
- **Chat**: `gpt-4o-mini` (default, configurable)
- **Embeddings**: `text-embedding-3-small` (1536 dimensions)
- **Title Generation**: `gpt-4o-mini` (in conversation_service)

### Current Dependencies
```
openai==2.8.0
tiktoken==0.12.0
```

## Azure OpenAI Setup Required

### 1. Azure Resources Needed
- **Azure OpenAI Service** resource
- **Deployments** for each model:
  - `gpt-4o-mini` (or gpt-4, gpt-35-turbo)
  - `text-embedding-3-small` (or text-embedding-ada-002)

### 2. Azure Deployment Names
You'll need to create deployments in Azure and note their names:
```
Chat Model Deployment: gpt-4o-mini-deployment
Embedding Model Deployment: text-embedding-3-small-deployment
```

### 3. Required Environment Variables
```bash
# Azure OpenAI Configuration
AZURE_OPENAI_ENDPOINT=https://YOUR_RESOURCE_NAME.openai.azure.com/
AZURE_OPENAI_API_KEY=your-azure-openai-api-key
AZURE_OPENAI_API_VERSION=2024-02-15-preview

# Model Deployment Names (created in Azure portal)
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4o-mini-deployment
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small-deployment

# Optional: Keep OpenAI as fallback
USE_AZURE_OPENAI=true  # Set to false to use regular OpenAI
OPENAI_API_KEY=sk-...  # Fallback if USE_AZURE_OPENAI=false
```

## Migration Implementation

### Step 1: Update Dependencies

**File**: `api/requirements.txt`

```diff
- openai==2.8.0
+ openai==2.8.0  # Azure OpenAI uses the same SDK!
+ azure-identity==1.15.0  # Already installed for blob storage
```

**Note**: Azure OpenAI uses the same `openai` Python package! Just configure it differently.

### Step 2: Create Azure OpenAI Client Utility

**New File**: `api/services/azure_openai_client.py`

```python
"""
Azure OpenAI client initialization and configuration
"""
import os
from openai import AsyncOpenAI, OpenAI
from typing import Optional

def get_azure_openai_client(async_client: bool = False):
    """
    Get Azure OpenAI client (sync or async)
    
    Args:
        async_client: If True, returns AsyncOpenAI, else returns OpenAI
        
    Returns:
        OpenAI or AsyncOpenAI client configured for Azure
    """
    use_azure = os.getenv("USE_AZURE_OPENAI", "true").lower() == "true"
    
    if use_azure:
        # Azure OpenAI configuration
        azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
        azure_api_key = os.getenv("AZURE_OPENAI_API_KEY")
        azure_api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")
        
        if not azure_endpoint or not azure_api_key:
            raise ValueError(
                "Azure OpenAI configuration missing. Set AZURE_OPENAI_ENDPOINT "
                "and AZURE_OPENAI_API_KEY environment variables."
            )
        
        if async_client:
            return AsyncOpenAI(
                api_key=azure_api_key,
                azure_endpoint=azure_endpoint,
                api_version=azure_api_version
            )
        else:
            return OpenAI(
                api_key=azure_api_key,
                azure_endpoint=azure_endpoint,
                api_version=azure_api_version
            )
    else:
        # Fall back to regular OpenAI
        openai_api_key = os.getenv("OPENAI_API_KEY")
        if not openai_api_key:
            raise ValueError("OPENAI_API_KEY environment variable not set")
        
        if async_client:
            return AsyncOpenAI(api_key=openai_api_key)
        else:
            return OpenAI(api_key=openai_api_key)


def get_chat_model_name() -> str:
    """Get the chat model deployment name"""
    use_azure = os.getenv("USE_AZURE_OPENAI", "true").lower() == "true"
    
    if use_azure:
        # Return Azure deployment name
        return os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT", "gpt-4o-mini-deployment")
    else:
        # Return OpenAI model name
        return "gpt-4o-mini"


def get_embedding_model_name() -> str:
    """Get the embedding model deployment name"""
    use_azure = os.getenv("USE_AZURE_OPENAI", "true").lower() == "true"
    
    if use_azure:
        # Return Azure deployment name
        return os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT", "text-embedding-3-small-deployment")
    else:
        # Return OpenAI model name
        return "text-embedding-3-small"
```

### Step 3: Update Chat Routes

**File**: `api/routes/chat.py`

```diff
from openai import AsyncOpenAI
import asyncio
from sqlalchemy.orm import Session

from database import get_db
from services.rag_service import get_rag_service
from services.conversation_service import get_conversation_service
from services.auth import get_current_user_optional
+ from services.azure_openai_client import get_azure_openai_client, get_chat_model_name
from models import User

router = APIRouter()

- # Initialize OpenAI client
- openai_api_key = os.getenv("OPENAI_API_KEY")
- if not openai_api_key:
-     print("WARNING: OPENAI_API_KEY not found in environment variables")
-     openai_client = None
- else:
-     openai_client = AsyncOpenAI(api_key=openai_api_key)
+ # Initialize Azure OpenAI client
+ try:
+     openai_client = get_azure_openai_client(async_client=True)
+     print(f"✓ Initialized Azure OpenAI client")
+ except Exception as e:
+     print(f"ERROR: Failed to initialize OpenAI client: {e}")
+     openai_client = None

# Pydantic models for request/response validation
class Message(BaseModel):
    role: str = Field(..., description="Message role: 'user', 'assistant', or 'system'")
    content: str = Field(..., description="Message content")

class ChatRequest(BaseModel):
    messages: List[Message] = Field(..., description="List of chat messages")
    conversation_id: Optional[int] = Field(default=None, description="ID of the conversation to save messages to")
-   model: str = Field(default="gpt-4o-mini", description="OpenAI model to use")
+   model: str = Field(default=None, description="Model deployment name (optional, uses default if not provided)")
    temperature: Optional[float] = Field(default=0.7, ge=0.0, le=2.0, description="Sampling temperature")
    max_tokens: Optional[int] = Field(default=2000, ge=1, le=4096, description="Maximum tokens to generate")
    stream: bool = Field(default=True, description="Whether to stream the response")
    use_rag: bool = Field(default=True, description="Whether to use RAG for context")
    top_k: int = Field(default=5, description="Number of documents to retrieve for RAG")
    similarity_threshold: float = Field(default=0.5, ge=0.0, le=1.0, description="Minimum similarity for RAG documents")
```

Then in the streaming function:

```diff
            # Create streaming chat completion
+           # Use provided model or get default deployment name
+           model_to_use = request.model if request.model else get_chat_model_name()
+           
            stream = await openai_client.chat.completions.create(
-               model=request.model,
+               model=model_to_use,
                messages=messages,
                temperature=request.temperature,
                max_tokens=request.max_tokens,
                stream=True
            )
```

### Step 4: Update Embedding Service

**File**: `api/services/embedding_service.py`

```diff
import os
import logging
from typing import List, Optional
- from openai import OpenAI
+ from services.azure_openai_client import get_azure_openai_client, get_embedding_model_name
import time

logger = logging.getLogger(__name__)

class EmbeddingService:
    """
    Generate embeddings using OpenAI's text-embedding models
    
    Uses text-embedding-3-small by default:
    - 1536 dimensions
    - $0.02 per 1M tokens (5x cheaper than ada-002)
    - Better performance than ada-002
    - Max context: 8191 tokens
    """
    
    def __init__(self):
        """Initialize embedding service"""
-       api_key = os.getenv("OPENAI_API_KEY")
-       if not api_key:
-           raise ValueError("OPENAI_API_KEY environment variable not set")
-       
-       self.client = OpenAI(api_key=api_key)
-       self.model = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
+       self.client = get_azure_openai_client(async_client=False)
+       self.model = get_embedding_model_name()
        self.dimensions = int(os.getenv("EMBEDDING_DIMENSIONS", "1536"))
        self.max_tokens = 8191  # Maximum tokens for text-embedding-3-small
        
        # Initialize tokenizer if available
        self.tokenizer = None
        if TIKTOKEN_AVAILABLE:
            try:
-               self.tokenizer = tiktoken.encoding_for_model(self.model)
+               # For Azure, use the base model name for tiktoken
+               base_model = "text-embedding-3-small"  # or get from env
+               self.tokenizer = tiktoken.encoding_for_model(base_model)
                logger.info(f"Initialized tiktoken encoder for {self.model}")
            except Exception as e:
                logger.warning(f"Could not initialize tiktoken for {self.model}: {e}")
```

### Step 5: Update Conversation Service

**File**: `api/services/conversation_service.py`

```diff
from models import Conversation, Message, ConversationDocument, Document, User
from models.conversation import MessageRole
import os
- from openai import AsyncOpenAI
+ from services.azure_openai_client import get_azure_openai_client, get_chat_model_name

- # Initialize OpenAI client for title generation
- openai_api_key = os.getenv("OPENAI_API_KEY")
- openai_client = AsyncOpenAI(api_key=openai_api_key) if openai_api_key else None
+ # Initialize Azure OpenAI client for title generation
+ try:
+     openai_client = get_azure_openai_client(async_client=True)
+ except Exception as e:
+     print(f"Warning: Could not initialize OpenAI client for title generation: {e}")
+     openai_client = None
```

In the title generation method:

```diff
            # Call OpenAI to generate title
+           model_to_use = get_chat_model_name()
            response = await openai_client.chat.completions.create(
-               model="gpt-4o-mini",
+               model=model_to_use,
                messages=[
                    {
                        "role": "system",
```

### Step 6: Update Environment Templates

**File**: `api/.env.template`

```diff
# ============================================
- # OpenAI Configuration (REQUIRED)
+ # AI Model Configuration (REQUIRED)
# ============================================
+ # Set to 'true' to use Azure OpenAI, 'false' for regular OpenAI
+ USE_AZURE_OPENAI=true
+
+ # Azure OpenAI Configuration (when USE_AZURE_OPENAI=true)
+ # Get these from Azure Portal > Azure OpenAI Service
+ AZURE_OPENAI_ENDPOINT=https://YOUR_RESOURCE_NAME.openai.azure.com/
+ AZURE_OPENAI_API_KEY=your-azure-openai-key
+ AZURE_OPENAI_API_VERSION=2024-02-15-preview
+
+ # Azure OpenAI Model Deployments (created in Azure portal)
+ AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4o-mini-deployment
+ AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small-deployment
+
+ # Regular OpenAI Configuration (when USE_AZURE_OPENAI=false)
# Get your API key from: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-your-openai-api-key-here
```

### Step 7: Update Docker Environment

**File**: `docker/docker-compose.yml` (and production variants)

Add Azure OpenAI environment variables to the API service:

```yaml
services:
  api:
    environment:
      - USE_AZURE_OPENAI=${USE_AZURE_OPENAI:-true}
      - AZURE_OPENAI_ENDPOINT=${AZURE_OPENAI_ENDPOINT}
      - AZURE_OPENAI_API_KEY=${AZURE_OPENAI_API_KEY}
      - AZURE_OPENAI_API_VERSION=${AZURE_OPENAI_API_VERSION:-2024-02-15-preview}
      - AZURE_OPENAI_CHAT_DEPLOYMENT=${AZURE_OPENAI_CHAT_DEPLOYMENT}
      - AZURE_OPENAI_EMBEDDING_DEPLOYMENT=${AZURE_OPENAI_EMBEDDING_DEPLOYMENT}
      - OPENAI_API_KEY=${OPENAI_API_KEY}  # Fallback
```

## Testing the Migration

### 1. Local Testing (OpenAI First)
```bash
# Test with regular OpenAI first
export USE_AZURE_OPENAI=false
export OPENAI_API_KEY=sk-...

# Start API
cd api
python main.py

# Test endpoints
curl -X POST http://localhost:8000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello"}]}'
```

### 2. Azure OpenAI Testing
```bash
# Switch to Azure
export USE_AZURE_OPENAI=true
export AZURE_OPENAI_ENDPOINT=https://YOUR_RESOURCE.openai.azure.com/
export AZURE_OPENAI_API_KEY=your-key
export AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4o-mini-deployment
export AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small-deployment

# Restart API and test
python main.py
```

### 3. Test All Features
- ✅ Chat streaming
- ✅ Message history
- ✅ RAG with embeddings
- ✅ Auto-generate conversation titles
- ✅ Document upload and embedding
- ✅ Search functionality

## Azure OpenAI Differences

### Key Differences from OpenAI

| Aspect | OpenAI | Azure OpenAI |
|--------|--------|--------------|
| **Endpoint** | `api.openai.com` | `YOUR_RESOURCE.openai.azure.com` |
| **Authentication** | `Bearer sk-...` | Custom API key in header |
| **Model Names** | `gpt-4o-mini` | Your deployment name (e.g., `gpt-4o-mini-deployment`) |
| **API Version** | Not needed | Required (e.g., `2024-02-15-preview`) |
| **SDK** | Same `openai` package | Same `openai` package |
| **Streaming** | Supported | Supported (same syntax) |
| **Function Calling** | Supported | Supported |

### API Call Syntax

**OpenAI**:
```python
client = OpenAI(api_key="sk-...")
response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[...]
)
```

**Azure OpenAI**:
```python
client = OpenAI(
    api_key="your-azure-key",
    azure_endpoint="https://resource.openai.azure.com/",
    api_version="2024-02-15-preview"
)
response = client.chat.completions.create(
    model="gpt-4o-mini-deployment",  # Your deployment name!
    messages=[...]
)
```

## Migration Checklist

### Pre-Migration
- [ ] Create Azure OpenAI resource in Azure Portal
- [ ] Deploy `gpt-4o-mini` (or gpt-4/gpt-35-turbo)
- [ ] Deploy `text-embedding-3-small` (or ada-002)
- [ ] Note deployment names
- [ ] Get endpoint URL and API key
- [ ] Test Azure deployments with simple API call

### Code Changes
- [ ] Create `api/services/azure_openai_client.py`
- [ ] Update `api/routes/chat.py`
- [ ] Update `api/services/embedding_service.py`
- [ ] Update `api/services/conversation_service.py`
- [ ] Update `api/.env.template`
- [ ] Update Docker environment files

### Testing
- [ ] Test with `USE_AZURE_OPENAI=false` (OpenAI fallback)
- [ ] Test with `USE_AZURE_OPENAI=true` (Azure)
- [ ] Test chat streaming
- [ ] Test embeddings generation
- [ ] Test title auto-generation
- [ ] Test document upload/search
- [ ] Performance testing
- [ ] Load testing

### Deployment
- [ ] Update production environment variables
- [ ] Deploy to staging
- [ ] Smoke test in staging
- [ ] Deploy to production
- [ ] Monitor logs for errors
- [ ] Monitor Azure OpenAI metrics

## Benefits of Azure OpenAI

1. **Enterprise Features**
   - Private network connectivity
   - Virtual network support
   - Managed identity authentication
   - Azure AD integration

2. **Compliance**
   - SOC 2, HIPAA, ISO certifications
   - Data residency (region selection)
   - No data retention for model improvement

3. **Cost Management**
   - Azure cost management tools
   - Committed use discounts
   - Pay with Azure credits

4. **Integration**
   - Azure Monitor integration
   - Application Insights
   - Azure Key Vault for secrets

5. **Reliability**
   - SLA-backed uptime
   - Regional failover
   - Rate limit management

## Potential Issues & Solutions

### Issue 1: Deployment Names
**Problem**: Forgetting to use deployment name instead of model name  
**Solution**: Use `get_chat_model_name()` helper function everywhere

### Issue 2: API Version
**Problem**: Wrong API version causes errors  
**Solution**: Pin to tested version (`2024-02-15-preview`)

### Issue 3: Tiktoken Encoding
**Problem**: Tiktoken needs base model name, not deployment name  
**Solution**: Map deployment to base model for tokenizer

### Issue 4: Rate Limits
**Problem**: Different rate limits than OpenAI  
**Solution**: Check Azure quota, request increase if needed

### Issue 5: Regional Availability
**Problem**: Model not available in selected region  
**Solution**: Check [Azure OpenAI model availability](https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/models)

## Rollback Plan

If issues occur in production:

1. **Quick Rollback** (< 1 minute):
   ```bash
   # In Azure App Service > Configuration
   USE_AZURE_OPENAI=false
   # Restart app
   ```

2. **Code Rollback**:
   - Revert to previous deployment
   - Fall back to OpenAI API

3. **Monitoring**:
   - Check error rates
   - Monitor response times
   - Verify model outputs

## Cost Comparison

### OpenAI Pricing (as of Dec 2024)
- `gpt-4o-mini`: $0.150/1M input, $0.600/1M output tokens
- `text-embedding-3-small`: $0.020/1M tokens

### Azure OpenAI Pricing
- Similar to OpenAI, region-dependent
- Provisioned throughput option for predictable costs
- Can use Azure credits/commitment discounts

## Documentation Updates Needed

- [ ] Update API README with Azure OpenAI setup
- [ ] Add Azure deployment guide
- [ ] Update troubleshooting docs
- [ ] Add monitoring/metrics guide
- [ ] Update development setup guide

## Timeline Estimate

- **Code Changes**: 2-4 hours
- **Testing**: 4-8 hours
- **Documentation**: 2-4 hours
- **Staging Deployment**: 1 hour
- **Production Deployment**: 1 hour
- **Total**: 10-18 hours

## Resources

- [Azure OpenAI Service Documentation](https://learn.microsoft.com/en-us/azure/ai-services/openai/)
- [OpenAI Python SDK with Azure](https://github.com/openai/openai-python#microsoft-azure-openai)
- [Azure OpenAI Model Availability](https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/models)
- [Azure OpenAI Quotas and Limits](https://learn.microsoft.com/en-us/azure/ai-services/openai/quotas-limits)

## Next Steps

1. **Immediate**: Create Azure OpenAI resource and deployments
2. **Development**: Implement `azure_openai_client.py` utility
3. **Testing**: Test locally with both OpenAI and Azure
4. **Staging**: Deploy to staging environment
5. **Production**: Gradual rollout with monitoring
