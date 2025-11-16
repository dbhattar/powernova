# PowerNOVA Architecture Diagram

## 🏗️ Azure Infrastructure Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Azure Resource Group                                 │
│                      "powernova-rg"                                      │
│                                                                           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │         Azure Container Registry (ACR)                             │  │
│  │              "powernovaacr"                                        │  │
│  │                                                                     │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │  │
│  │  │  website     │  │  chat-app    │  │  api         │           │  │
│  │  │  :latest     │  │  :latest     │  │  :latest     │           │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘           │  │
│  │     (~50MB)           (~50MB)           (~200MB)                  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │         App Service Plan "powernova-plan"                          │  │
│  │         SKU: B1 ($13/month)                                        │  │
│  │         1 vCPU, 1.75GB RAM, 10GB Storage                           │  │
│  │                                                                     │  │
│  │  ┌───────────┐      ┌───────────┐      ┌───────────────┐         │  │
│  │  │  App #1   │      │  App #2   │      │  App #3       │         │  │
│  │  │  web      │      │  chat     │      │  api          │         │  │
│  │  │           │      │           │      │               │         │  │
│  │  │  nginx    │      │  nginx    │      │  FastAPI      │         │  │
│  │  │  :80      │      │  :80      │      │  :8000        │         │  │
│  │  │  HTTPS ✓  │      │  HTTPS ✓  │      │  HTTPS ✓      │         │  │
│  │  │           │      │           │      │  OpenAI ✓     │         │  │
│  │  └───────────┘      └───────────┘      └───────────────┘         │  │
│  │       │                   │                    │                  │  │
│  └───────┼───────────────────┼────────────────────┼──────────────────┘  │
│          │                   │                    │                     │
└──────────┼───────────────────┼────────────────────┼─────────────────────┘
           │                   │                    │
           ▼                   ▼                    ▼
    www.powernova.ai    app.powernova.ai    api.powernova.ai
```

## 🌐 Traffic Flow

### Landing Page Request Flow

```
User Browser
    │
    │ 1. Request: https://www.powernova.ai
    │
    ▼
┌─────────────────┐
│  DNS Server     │
│  (Your Provider)│
└─────────────────┘
    │
    │ 2. CNAME Lookup
    │    www → powernova-web.azurewebsites.net
    │
    ▼
┌─────────────────────────────────┐
│  Azure App Service              │
│  "powernova-web"                │
│                                 │
│  ┌───────────────────────────┐ │
│  │  nginx:alpine             │ │
│  │  Serves: website/         │ │
│  │  - index.html             │ │
│  │  - css/styles.css         │ │
│  │  - js/script.js           │ │
│  └───────────────────────────┘ │
└─────────────────────────────────┘
    │
    │ 3. HTTPS Response (SSL enabled)
    │
    ▼
User sees landing page
```

### Chat App Request Flow

```
User Browser
    │
    │ 1. Request: https://app.powernova.ai
    │
    ▼
┌─────────────────┐
│  DNS Server     │
│  (Your Provider)│
└─────────────────┘
    │
    │ 2. CNAME Lookup
    │    app → powernova-chat.azurewebsites.net
    │
    ▼
┌─────────────────────────────────┐
│  Azure App Service              │
│  "powernova-chat"               │
│                                 │
│  ┌───────────────────────────┐ │
│  │  nginx:alpine             │ │
│  │  Serves: app/             │ │
│  │  - index.html             │ │
│  │  - css/styles.css         │ │
│  │  - js/app.js              │ │
│  └───────────────────────────┘ │
└─────────────────────────────────┘
    │
    │ 3. HTTPS Response (SSL enabled)
    │
    ▼
User sees chat interface
```

### Chat with AI Flow (Complete Journey)

```
User Browser (app.powernova.ai)
    │
    │ 1. User types message: "What are CAISO procedures?"
    │
    ▼
┌─────────────────────────────────┐
│  JavaScript (app.js)            │
│  Sends POST request to:         │
│  https://api.powernova.ai       │
│  /api/chat/stream               │
└─────────────────────────────────┘
    │
    │ 2. HTTPS Request with message history
    │
    ▼
┌─────────────────────────────────┐
│  Azure App Service              │
│  "powernova-api"                │
│                                 │
│  ┌───────────────────────────┐ │
│  │  FastAPI Backend          │ │
│  │  - Validates request      │ │
│  │  - Checks CORS            │ │
│  │  - Prepares for OpenAI    │ │
│  └───────────────────────────┘ │
└─────────────────────────────────┘
    │
    │ 3. Calls OpenAI API with streaming
    │
    ▼
┌─────────────────────────────────┐
│  OpenAI API                     │
│  gpt-4o-mini                    │
│                                 │
│  Generates response and         │
│  streams tokens back            │
└─────────────────────────────────┘
    │
    │ 4. SSE Stream (Server-Sent Events)
    │    data: {"content": "CAISO"}
    │    data: {"content": "'s interconnection"}
    │    data: {"content": " procedures..."}
    │    data: [DONE]
    │
    ▼
┌─────────────────────────────────┐
│  FastAPI Backend                │
│  Proxies stream to client       │
│  (keeps API key secure)         │
└─────────────────────────────────┘
    │
    │ 5. SSE Stream forwarded
    │
    ▼
┌─────────────────────────────────┐
│  JavaScript (app.js)            │
│  - Receives stream chunks       │
│  - Updates UI in real-time      │
│  - Shows typing animation       │
└─────────────────────────────────┘
    │
    │ 6. Displays message
    │
    ▼
User sees AI response appear word-by-word!
```

## 💰 Cost Breakdown

```
┌────────────────────────────────────────────────┐
│  Monthly Cost Breakdown                        │
├────────────────────────────────────────────────┤
│                                                │
│  App Service Plan (B1)              $13.00    │
│  ├─ powernova-web                   included  │
│  ├─ powernova-chat                  included  │
│  └─ powernova-api                   included  │
│                                                │
│  Azure Container Registry (Basic)    $5.00    │
│  ├─ powernova-website:latest        included  │
│  ├─ powernova-chat-app:latest       included  │
│  └─ powernova-api:latest            included  │
│                                                │
│  Bandwidth (first 100GB)             FREE     │
│                                                │
│  SSL Certificates (3x)               FREE     │
│  (Azure Managed)                              │
│                                                │
│  OpenAI API Costs                   VARIABLE  │
│  (pay-per-use, ~$0.15-0.60/1M tokens)         │
│                                                │
├────────────────────────────────────────────────┤
│  TOTAL INFRASTRUCTURE:              ~$18/mo   │
│  TOTAL with OpenAI usage:           ~$20-30/mo│
└────────────────────────────────────────────────┘
```

## 🔄 Deployment Pipeline

### Initial Deployment

```
Developer                    Azure
    │                          │
    │                          │
    ├─ 1. Run azure-deploy.sh ─┤
    │                          │
    │                     Creates:
    │                     ├─ Resource Group
    │                     ├─ ACR
    │                     └─ App Service Plan
    │                          │
    ├─ 2. Builds Docker Image ─┤
    │    (website/)            │
    │                     Pushes to ACR
    │                          │
    │                     Creates:
    │                     └─ App Service #1
    │                        (powernova-web)
    │                          │
    ├─ 3. Run azure-deploy-chat.sh
    │                          │
    │                     Reuses:
    │                     ├─ Resource Group
    │                     ├─ ACR
    │                     └─ App Service Plan
    │                          │
    ├─ 4. Builds Docker Image ─┤
    │    (app/)               │
    │                     Pushes to ACR
    │                          │
    │                     Creates:
    │                     └─ App Service #2
    │                        (powernova-chat)
    │                          │
    ├─ 5. Configure DNS ───────┤
    │    (CNAME records)       │
    │                          │
    ├─ 6. Add Custom Domains ──┤
    │    - www.powernova.ai    │
    │    - app.powernova.ai    │
    │                          │
    ▼                          ▼
  Done!                   Both apps live
```

### Update Deployment (Code Changes)

```
Developer                    Azure
    │                          │
    │                          │
    ├─ Make changes to website/
    │                          │
    ├─ ./azure-deploy.sh --update
    │                          │
    │                     ├─ Rebuilds image
    │                     ├─ Pushes to ACR
    │                     ├─ Updates web app
    │                     └─ Restarts container
    │                          │
    │                    Landing page updated!
    │                          │
    ├─ Make changes to app/    │
    │                          │
    ├─ ./azure-deploy-chat.sh --update
    │                          │
    │                     ├─ Rebuilds image
    │                     ├─ Pushes to ACR
    │                     ├─ Updates web app
    │                     └─ Restarts container
    │                          │
    ▼                    Chat app updated!
```

## 🔐 Security Layers

```
┌─────────────────────────────────────────────────┐
│  Layer 1: DNS & Network                         │
│  ├─ HTTPS enforced                              │
│  ├─ TLS 1.2 minimum                             │
│  └─ Azure DDoS protection                       │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│  Layer 2: App Service                           │
│  ├─ Managed SSL certificates                    │
│  ├─ HTTPS-only redirect                         │
│  ├─ Security headers (nginx)                    │
│  │  ├─ X-Frame-Options: SAMEORIGIN              │
│  │  ├─ X-Content-Type-Options: nosniff          │
│  │  └─ X-XSS-Protection: 1; mode=block          │
│  └─ Custom domain binding                       │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│  Layer 3: Container                             │
│  ├─ Minimal nginx:alpine base                   │
│  ├─ No root access required                     │
│  ├─ Health checks enabled                       │
│  └─ Container logging                           │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│  Layer 4: Container Registry                    │
│  ├─ Private ACR (not public)                    │
│  ├─ Admin credentials secured                   │
│  └─ Image scanning (optional)                   │
└─────────────────────────────────────────────────┘
```

## 📊 Resource Relationships

```
Resource Group: powernova-rg
│
├─── Container Registry: powernovaacr
│    ├─── Repository: powernova-website
│    │    └─── Tag: latest
│    └─── Repository: powernova-chat-app
│         └─── Tag: latest
│
└─── App Service Plan: powernova-plan (B1)
     ├─── App Service: powernova-web
     │    ├─── Source: powernovaacr/powernova-website:latest
     │    ├─── Default URL: powernova-web.azurewebsites.net
     │    └─── Custom Domain: www.powernova.ai
     │         └─── SSL: Managed (free)
     │
     └─── App Service: powernova-chat
          ├─── Source: powernovaacr/powernova-chat-app:latest
          ├─── Default URL: powernova-chat.azurewebsites.net
          └─── Custom Domain: app.powernova.ai
               └─── SSL: Managed (free)
```

## 🎯 Key Advantages of This Architecture

```
┌──────────────────────────┬────────────────────────────────┐
│ Advantage                │ Benefit                        │
├──────────────────────────┼────────────────────────────────┤
│ Shared App Service Plan  │ One cost for both apps         │
│ Separate App Services    │ Independent deployments        │
│ Container-based          │ Consistent across environments │
│ Custom domains           │ Professional branding          │
│ Free SSL                 │ Secure by default              │
│ Health checks            │ Auto-recovery                  │
│ Separate ACR repos       │ Independent versioning         │
└──────────────────────────┴────────────────────────────────┘
```

---

**This architecture provides:**
- ✅ Cost efficiency (shared plan)
- ✅ Operational simplicity (independent apps)
- ✅ Scalability (can separate plans later)
- ✅ Professional domains (www vs app)
- ✅ Security (HTTPS, managed certs)
- ✅ Maintainability (separate codebases)
