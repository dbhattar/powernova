# PowerNOVA Container - Project Organization

> **Note**: This document serves as a reference for the project structure and organization principles.

## 📁 Current Directory Structure (v1.3.0)

```
container/
├── website/                         # Static landing page (www.powernova.ai)
│   ├── index.html                  # Main landing page
│   ├── css/
│   │   └── styles.css              # Stylesheet
│   └── js/
│       └── script.js               # JavaScript functionality
│
├── app/                             # Chat interface (app.powernova.ai)
│   ├── index.html                  # Chat application
│   ├── css/
│   │   └── styles.css              # Chat app styles
│   └── js/
│       └── app.js                  # Chat functionality
│
├── docker/                          # Docker configuration files
│   ├── Dockerfile                  # Landing page container
│   ├── Dockerfile.app              # Chat app container
│   ├── nginx.conf                  # Landing page nginx config
│   ├── nginx-app.conf              # Chat app nginx config
│   ├── docker-compose.yml          # Local development orchestration (both apps)
│   └── .dockerignore               # Docker build exclusions
│
├── scripts/                         # Utility scripts
│   ├── docker-helper.sh            # Docker management helper
│   ├── azure-deploy.sh             # Azure deployment automation
│   └── azure-manage.sh             # Azure management operations
│
├── docs/                            # 📚 All documentation
│   ├── DEPLOYMENT.md               # Azure deployment guide
│   ├── AZURE-SCRIPTS-GUIDE.md      # Scripts documentation
│   ├── MIGRATION-GUIDE.md          # Reorganization guide
│   ├── CHANGELOG.md                # Version history
│   └── PROJECT-STRUCTURE.md        # This file
│
├── .github/                         # GitHub configuration
│   └── workflows/
│       └── azure-deploy.yml        # CI/CD pipeline
│
├── .gitignore                       # Git exclusions
└── README.md                        # Quick reference guide (root)
```

## 📋 Organization Principles

### 1. **Separation of Concerns**
Each directory has a single, clear purpose:
- `website/` - Only website content (HTML, CSS, JS)
- `docker/` - Only Docker configuration
- `scripts/` - Only utility scripts
- `docs/` - Only documentation files

### 2. **Clean Root Directory**
The project root contains only:
- Essential configuration files (`.gitignore`)
- Main documentation (`README.md`)
- Organizational folders

### 3. **Logical Grouping**
Related files are grouped together:
- All Docker files in one place
- All documentation in one place
- All scripts in one place

### 4. **Scalability**
The structure easily accommodates future additions:
```
container/
├── website/         # Frontend (current)
├── api/            # Backend API (future)
├── database/       # Database configs (future)
├── docker/         # All Docker files
├── scripts/        # All scripts
└── docs/           # All documentation
```

## 🗂️ File Purposes

### Root Level
| File/Folder | Purpose |
|-------------|---------|
| `README.md` | Quick reference and getting started guide |
| `.gitignore` | Git version control exclusions |
| `.github/` | GitHub Actions workflows and configs |

### website/
| File/Folder | Purpose |
|-------------|---------|
| `index.html` | Main landing page HTML |
| `css/styles.css` | Styling and design |
| `js/script.js` | Interactive functionality |

### app/
| File/Folder | Purpose |
|-------------|---------|
| `index.html` | Chat interface HTML |
| `css/styles.css` | Chat app styling |
| `js/app.js` | Chat functionality and AI integration |

### docker/
| File | Purpose |
|------|---------|
| `Dockerfile` | Landing page container image |
| `Dockerfile.app` | Chat app container image |
| `nginx.conf` | Landing page web server config |
| `nginx-app.conf` | Chat app web server config |
| `docker-compose.yml` | Local multi-container orchestration |
| `.dockerignore` | Files to exclude from Docker builds |

### scripts/
| File | Purpose |
|------|---------|
| `docker-helper.sh` | Simplified Docker command wrapper |
| `azure-deploy.sh` | Automated Azure deployment |
| `azure-manage.sh` | Azure management operations |

### docs/
| File | Purpose |
|------|---------|
| `DEPLOYMENT.md` | Complete Azure deployment guide |
| `MIGRATION-GUIDE.md` | Guide for project reorganization |
| `CHANGELOG.md` | Version history and changes |
| `PROJECT-STRUCTURE.md` | This file - project organization reference |

## 🎯 Why This Structure?

### Benefits

1. **Easy Navigation**
   - New team members can quickly find what they need
   - Clear folder names indicate content
   - Logical hierarchy

2. **Maintainability**
   - Changes are isolated to specific folders
   - Related files are together
   - Easy to update or replace components

3. **Scalability**
   - Easy to add new services
   - Structure supports growth
   - Future-proof organization

4. **Best Practices**
   - Follows industry standards
   - Common pattern in DevOps projects
   - Works well with CI/CD

## 📝 Documentation Guidelines

### Where to Add Documentation

| Type of Documentation | Location | Example |
|-----------------------|----------|---------|
| Quick reference / Getting started | `README.md` (root) | Quick start commands |
| Detailed guides | `docs/` | Deployment procedures |
| API documentation | `docs/api/` | API endpoints (future) |
| Architecture docs | `docs/architecture/` | System design (future) |
| Release notes | `docs/CHANGELOG.md` | Version history |

### Documentation Hierarchy

1. **README.md** (Root)
   - First point of contact
   - Quick start guide
   - Links to detailed docs

2. **docs/** (Detailed)
   - Comprehensive guides
   - Step-by-step instructions
   - Reference materials

## 🔄 Evolution History

### v1.0.0 - Initial Setup
```
container/
├── website/
├── Dockerfile
├── nginx.conf
├── docker-compose.yml
└── ...
```
**Issue**: Cluttered root directory

### v1.1.0 - First Reorganization
```
container/
├── website/
├── docker/
├── scripts/
└── ...
```
**Improvement**: Separated Docker files and scripts

### v1.2.0 - Documentation Reorganization (Current)
```
container/
├── website/
├── docker/
├── scripts/
├── docs/           # 📚 New
└── README.md
```
**Improvement**: All documentation in one place

### Future (v2.0.0+) - Multi-Container
```
container/
├── website/
├── api/           # Backend service
├── database/      # Database configs
├── docker/
├── scripts/
└── docs/
```

## 🚀 Future Considerations

### Adding New Services

When adding a new service (e.g., API, database):

1. **Create service folder at root level**
   ```
   container/
   ├── website/
   ├── api/           # New service
   ```

2. **Add service-specific Docker config**
   ```
   docker/
   ├── Dockerfile.website
   ├── Dockerfile.api     # New
   ├── docker-compose.yml  # Updated
   ```

3. **Document in docs/**
   ```
   docs/
   ├── DEPLOYMENT.md       # Updated
   ├── api/               # New
   │   └── API-GUIDE.md
   ```

4. **Add helper scripts**
   ```
   scripts/
   ├── docker-helper.sh
   ├── api-helper.sh      # New
   ```

## 📌 Key Takeaways

1. **Keep root clean** - Only essential files and folders
2. **Group related files** - Docker, scripts, docs in separate folders
3. **Document structure** - This file explains the organization
4. **Plan for growth** - Structure supports future expansion
5. **Follow conventions** - Industry-standard patterns

## 🔗 Related Documentation

- [README.md](../README.md) - Quick reference guide
- [DEPLOYMENT.md](DEPLOYMENT.md) - Azure deployment
- [MIGRATION-GUIDE.md](MIGRATION-GUIDE.md) - Reorganization guide
- [CHANGELOG.md](CHANGELOG.md) - Version history

---

**Last Updated**: November 15, 2025  
**Version**: 1.2.0  
**Maintained by**: PowerNOVA Team
