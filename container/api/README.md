# PowerNOVA API

FastAPI backend for PowerNOVA chat interface with OpenAI integration and RAG capabilities.

## 🏗️ Architecture

```
PowerNOVA API
├── main.py                 # FastAPI app entry point
├── routes/
│   ├── __init__.py
│   └── chat.py            # Chat completion endpoints
├── requirements.txt        # Python dependencies
├── .env.example           # Environment variables template
└── .gitignore
```

## 🚀 Features

- ✅ **OpenAI Streaming**: Real-time chat completions with Server-Sent Events (SSE)
- ✅ **CORS Support**: Pre-configured for app.powernova.ai and localhost
- ✅ **Health Checks**: Azure App Service compatible health endpoints
- ✅ **API Documentation**: Auto-generated Swagger UI at `/docs`
- ✅ **Type Safety**: Pydantic models for request/response validation
- ✅ **Production Ready**: Async/await, proper error handling, logging

## 📋 Prerequisites

- Python 3.11+
- OpenAI API key from [platform.openai.com](https://platform.openai.com/api-keys)
- Docker (for containerized deployment)

## 🛠️ Local Development

### 1. Install Dependencies

```bash
cd api
pip install -r requirements.txt
```

### 2. Set Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and add your OpenAI API key:

```env
OPENAI_API_KEY=sk-your-actual-api-key-here
PORT=8000
ENVIRONMENT=development
```

### 3. Run the API

```bash
# Development mode with auto-reload
python main.py

# Or using uvicorn directly
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:
- **API**: http://localhost:8000
- **Health Check**: http://localhost:8000/health
- **API Docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## 🐳 Docker Development

### Using Docker Compose (Recommended)

From the project root:

```bash
cd docker
docker-compose up -d powernova-api
```

This starts all three services:
- Landing page: http://localhost:8080
- Chat UI: http://localhost:8081
- API: http://localhost:8000

**Note**: Make sure to set `OPENAI_API_KEY` in your environment or in `docker/.env`

### Build and Run Manually

```bash
# Build the image
docker build -t powernova-api -f docker/Dockerfile.api.local .

# Run the container
docker run -p 8000:8000 \
  -e OPENAI_API_KEY=your-key-here \
  -v $(pwd):/app \
  powernova-api
```

## 🌐 API Endpoints

### Chat Endpoints

#### POST `/api/chat/stream`

Stream chat completions from OpenAI using Server-Sent Events (SSE).

**Request Body:**
```json
{
  "messages": [
    { "role": "user", "content": "What are CAISO interconnection procedures?" }
  ],
  "model": "gpt-4o-mini",
  "temperature": 0.7,
  "max_tokens": 2000,
  "stream": true
}
```

**Response:** SSE stream

```
data: {"id": "chatcmpl-123", "content": "CAISO", "role": "assistant", "model": "gpt-4o-mini"}
data: {"id": "chatcmpl-123", "content": "'s interconnection", "role": "assistant", "model": "gpt-4o-mini"}
...
data: [DONE]
```

#### POST `/api/chat`

Non-streaming chat completion endpoint.

**Request Body:**
```json
{
  "messages": [
    { "role": "user", "content": "Explain FERC Order 2023" }
  ],
  "model": "gpt-4o-mini",
  "temperature": 0.7,
  "max_tokens": 2000
}
```

**Response:**
```json
{
  "id": "chatcmpl-123",
  "content": "FERC Order 2023...",
  "role": "assistant",
  "model": "gpt-4o-mini",
  "finish_reason": "stop"
}
```

### Health Endpoints

#### GET `/health`

Main health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "powernova-api",
  "version": "1.0.0"
}
```

#### GET `/api/chat/health`

Check OpenAI API connectivity.

**Response:**
```json
{
  "status": "healthy",
  "message": "OpenAI API is accessible",
  "models_available": true
}
```

## 🔒 Security

### CORS Configuration

The API is configured to accept requests from:
- `https://app.powernova.ai` (production)
- `https://www.powernova.ai` (production landing page)
- `http://localhost:8081` (local chat UI)
- `http://localhost:8080` (local landing page)

To add more origins, edit `main.py`:

```python
ALLOWED_ORIGINS = [
    "https://app.powernova.ai",
    "https://your-new-domain.com"
]
```

### API Keys

- **Never commit API keys** to version control
- Use environment variables for all secrets
- In Azure, set keys in App Service Configuration
- Rotate keys regularly

## 📦 Dependencies

```
fastapi==0.109.0          # Web framework
uvicorn[standard]==0.27.0 # ASGI server
openai==1.10.0            # OpenAI SDK
python-dotenv==1.0.1      # Environment variables
pydantic==2.5.3           # Data validation
httpx==0.26.0             # Async HTTP client
```

## 🚀 Azure Deployment

### Deploy to Azure App Service

```bash
cd scripts
./azure-deploy-api.sh
```

The script will:
1. Build the Docker image
2. Push to Azure Container Registry
3. Deploy to App Service
4. Configure environment variables
5. Enable HTTPS

### Manual Deployment

```bash
# Login to Azure
az login

# Build and push image
az acr build \
  --registry powernovaacr \
  --image powernova-api:latest \
  --file docker/Dockerfile.api \
  api/

# Update App Service
az webapp config container set \
  --name powernova-api \
  --resource-group powernova-rg \
  --docker-custom-image-name powernovaacr.azurecr.io/powernova-api:latest
```

### Set Environment Variables in Azure

```bash
az webapp config appsettings set \
  --name powernova-api \
  --resource-group powernova-rg \
  --settings \
    OPENAI_API_KEY="your-key" \
    PORT="8000" \
    ENVIRONMENT="production"
```

## 🔍 Testing

### Test Health Endpoint

```bash
curl http://localhost:8000/health
```

### Test Chat Streaming

```bash
curl -X POST http://localhost:8000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "model": "gpt-4o-mini"
  }'
```

### Test from Frontend

Open the chat UI (http://localhost:8081) and send a message. Check browser DevTools Network tab to see API calls.

## 📊 Monitoring

### View Logs (Azure)

```bash
az webapp log tail \
  --name powernova-api \
  --resource-group powernova-rg
```

### View Logs (Docker)

```bash
docker logs -f powernova-api
```

## 🛣️ Roadmap

Future enhancements planned:

- [ ] **RAG Integration**: Vector database for document search
- [ ] **Authentication**: JWT tokens for API access
- [ ] **Rate Limiting**: Prevent API abuse
- [ ] **Caching**: Redis for response caching
- [ ] **WebSocket Support**: Real-time bidirectional communication
- [ ] **File Upload**: Process PDF/DOCX documents
- [ ] **Analytics**: Track usage and performance
- [ ] **Multi-model Support**: Switch between GPT-4, Claude, etc.

## 🤝 Contributing

When adding new endpoints:

1. Create route in `routes/` folder
2. Add Pydantic models for validation
3. Include proper error handling
4. Add docstrings for auto-generated docs
5. Update this README

## 📝 License

Proprietary - PowerNOVA

## 🆘 Troubleshooting

### API not starting

```bash
# Check if port 8000 is available
lsof -i :8000

# Check environment variables
echo $OPENAI_API_KEY
```

### OpenAI API errors

- Verify API key is correct
- Check OpenAI account has credits
- View logs: `docker logs powernova-api`

### CORS errors

- Check browser console for specific origin
- Add origin to `ALLOWED_ORIGINS` in `main.py`
- Rebuild and restart container

## 📚 Additional Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [Azure App Service Docs](https://docs.microsoft.com/en-us/azure/app-service/)
- [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
