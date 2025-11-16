# PowerNOVA API - Quick Start Guide

## 🎯 Goal

Get the FastAPI backend running locally and connected to the chat UI.

## ⚡ Quick Start (5 minutes)

### 1. Get OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Copy it (starts with `sk-...`)

### 2. Set Environment Variable

**Mac/Linux:**
```bash
export OPENAI_API_KEY="sk-your-actual-key-here"
```

**Windows (PowerShell):**
```powershell
$env:OPENAI_API_KEY="sk-your-actual-key-here"
```

Or create `api/.env` file:
```env
OPENAI_API_KEY=sk-your-actual-key-here
```

### 3. Start with Docker Compose (Easiest)

```bash
cd docker
docker-compose up -d
```

This starts:
- ✅ Landing page → http://localhost:8080
- ✅ Chat UI → http://localhost:8081
- ✅ API → http://localhost:8000

### 4. Test the API

```bash
# Health check
curl http://localhost:8000/health

# Should return:
# {"status":"healthy","service":"powernova-api","version":"1.0.0"}
```

### 5. Test the Chat

1. Open http://localhost:8081
2. Click an example question or type your own
3. Watch the AI response stream in real-time! 🎉

## 🔍 Verify Everything Works

### Check API is Running

```bash
curl http://localhost:8000/health
```

**Expected:** `{"status":"healthy",...}`

### Check OpenAI Connection

```bash
curl http://localhost:8000/api/chat/health
```

**Expected:** `{"status":"healthy","message":"OpenAI API is accessible",...}`

### Send Test Message

```bash
curl -X POST http://localhost:8000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Say hello!"}],
    "model": "gpt-4o-mini"
  }'
```

**Expected:** Stream of SSE data with AI response

### Check Logs

```bash
# View API logs
docker logs -f powernova-api

# View chat UI logs
docker logs -f powernova-chat-app
```

## 🐛 Troubleshooting

### Problem: "OpenAI API key not configured"

**Solution:**
```bash
# Stop containers
docker-compose down

# Set environment variable
export OPENAI_API_KEY="sk-your-key"

# Start again
docker-compose up -d
```

### Problem: "Cannot connect to API"

**Check:**
```bash
# Is API running?
docker ps | grep powernova-api

# Check API logs
docker logs powernova-api

# Try health check
curl http://localhost:8000/health
```

**Solution:**
```bash
# Restart API
docker restart powernova-api
```

### Problem: "CORS error in browser"

**Check:**
- Open browser DevTools → Console
- Look for CORS error message

**Solution:**
The API is pre-configured for localhost:8081. If you're using a different port, update `api/main.py`:

```python
ALLOWED_ORIGINS = [
    "http://localhost:8081",  # Your chat UI port
    "http://localhost:3000",  # Add other ports if needed
]
```

### Problem: Port 8000 already in use

**Find what's using it:**
```bash
lsof -i :8000
```

**Solution:**
```bash
# Kill the process or change port in docker-compose.yml
ports:
  - "8001:8000"  # Use 8001 instead
```

## 📊 Development Workflow

### Making Changes to the API

1. Edit files in `api/` folder
2. Changes are hot-reloaded automatically (volume mount)
3. Check logs: `docker logs -f powernova-api`

### Making Changes to Frontend

1. Edit files in `app/` folder
2. Rebuild chat container:
   ```bash
   docker-compose build powernova-chat
   docker-compose up -d powernova-chat
   ```
3. Refresh browser

### Rebuild Everything

```bash
cd docker
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 🎨 Customization

### Change AI Model

Edit `app/js/app.js`:
```javascript
body: JSON.stringify({
    messages: messages,
    model: 'gpt-4',  // Change to gpt-4, gpt-4-turbo, etc.
    temperature: 0.7,
    max_tokens: 2000
})
```

### Adjust Response Length

```javascript
max_tokens: 4000,  // Increase for longer responses
```

### Change Temperature (Creativity)

```javascript
temperature: 0.3,  // Lower = more focused
temperature: 1.0,  // Higher = more creative
```

## 🚀 Next Steps

### Local Development
- ✅ API is running
- ✅ Chat UI connected
- 🎯 Add RAG capabilities (vector database, document search)
- 🎯 Add authentication
- 🎯 Add conversation history persistence

### Deploy to Production

```bash
# Deploy API to Azure
cd scripts
./azure-deploy-api.sh

# Follow prompts to:
# - Use existing Resource Group
# - Use existing Container Registry
# - Use existing App Service Plan
# - Enter OpenAI API key
```

## 📚 More Information

- **API Documentation**: http://localhost:8000/docs
- **API README**: `api/README.md`
- **Architecture Docs**: `docs/ARCHITECTURE-DIAGRAM.md`
- **Deployment Guide**: `docs/DUAL-APP-DEPLOYMENT.md`

## ✅ Success Checklist

Before moving on, verify:

- [ ] Health check works: `curl http://localhost:8000/health`
- [ ] OpenAI check works: `curl http://localhost:8000/api/chat/health`
- [ ] Chat UI loads: http://localhost:8081
- [ ] Can send messages and get AI responses
- [ ] Responses stream in real-time
- [ ] Browser console shows no CORS errors
- [ ] Docker logs show no errors

## 🎉 You're Ready!

Your PowerNOVA chat system is now:
- ✅ Serving static UI with nginx
- ✅ Running FastAPI backend
- ✅ Streaming responses from OpenAI
- ✅ Ready for RAG enhancement

**Next:** Add vector database for document search and RAG capabilities!
