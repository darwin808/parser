# Invoice Parser System

Unified invoice parsing system with Next.js frontend, Express backend, and Python LLM service.

## 🏗️ Architecture

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Next.js       │─────▶│    Express      │─────▶│   Python LLM    │
│   Frontend      │      │    Backend      │      │   (FastAPI)     │
│   Port: 3000    │      │   Port: 3001    │      │   Port: 8000    │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                                                            │
                                                            ▼
                                                    ┌─────────────────┐
                                                    │     Ollama      │
                                                    │   Port: 11434   │
                                                    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.9+
- Ollama installed and running

### 1. Complete Setup (First Time)
```bash
make setup
```

This will:
- Install all dependencies (npm + pip)
- Check if Ollama is running
- Set up environment variables

### 2. Move Your Projects
```bash
# Copy your existing projects into:
# - frontend/     (your Next.js app)
# - backend/      (your Express app)
# - llm-service/  (your Python FastAPI app)
```

### 3. Start Everything
```bash
make dev
```

That's it! All three services will start simultaneously.

## 📋 Available Commands

### Main Commands
| Command | Description |
|---------|-------------|
| `make help` | Show all available commands |
| `make dev` | Start all services in dev mode 🚀 |
| `make status` | Check service status 📊 |
| `make restart` | Restart all services 🔄 |
| `make info` | Show project information ℹ️ |

### Development
| Command | Description |
|---------|-------------|
| `make dev-next` | Start Next.js only |
| `make dev-express` | Start Express only |
| `make dev-python` | Start Python only |

### Installation
| Command | Description |
|---------|-------------|
| `make install` | Install all dependencies |
| `make install-next` | Install Next.js dependencies |
| `make install-express` | Install Express dependencies |
| `make install-python` | Install Python dependencies |

### Build
| Command | Description |
|---------|-------------|
| `make build` | Build all services |
| `make build-next` | Build Next.js |
| `make build-express` | Build Express |

### Cleanup
| Command | Description |
|---------|-------------|
| `make clean` | Clean all build artifacts |
| `make clean-next` | Clean Next.js only |
| `make clean-express` | Clean Express only |
| `make clean-python` | Clean Python cache |

### Utilities
| Command | Description |
|---------|-------------|
| `make ports-check` | Check if ports are available |
| `make ports-kill` | Kill processes on ports |
| `make logs` | Show logs from all services |
| `make test` | Run all tests |
| `make lint` | Lint all code |

### Ollama
| Command | Description |
|---------|-------------|
| `make ollama-check` | Check if Ollama is running |
| `make ollama-pull` | Pull qwen2.5vl model |
| `make ollama-list` | List installed models |

## 🔧 Configuration

Edit `.env` file:

```env
# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001

# Backend
PORT=3001
LLM_SERVICE_URL=http://localhost:8000

# Python LLM
PORT=8000
OLLAMA_HOST=http://localhost:11434
MODEL_NAME=qwen2.5vl:latest
```

## 📁 Project Structure

```
invoice-parser-system/
├── Makefile              # All commands
├── package.json          # Root npm config
├── .env                  # Environment variables
├── README.md
│
├── frontend/             # Next.js app
│   ├── package.json
│   ├── next.config.js
│   └── src/
│
├── backend/              # Express API
│   ├── package.json
│   ├── server.js
│   └── src/
│
├── llm-service/          # Python FastAPI
│   ├── requirements.txt
│   ├── main.py
│   └── .env
│
└── shared/               # Shared code
    ├── types/
    └── utils/
```

## 🐛 Troubleshooting

### Ports Already in Use
```bash
make ports-kill
```

### Services Not Starting
```bash
# Check status
make status

# Check ports
make ports-check

# Restart everything
make restart
```

### Ollama Not Running
```bash
# Start Ollama
ollama serve

# Check if running
make ollama-check
```

### Clean Install
```bash
make clean
make install
make dev
```

## 🎯 Workflow Examples

### Daily Development
```bash
# Morning - start working
make dev

# Check if everything is running
make status
```

### After Pulling New Code
```bash
make install
make dev
```

### Before Committing
```bash
make lint
make test
```

### Deployment
```bash
make build
make start
```

## 📊 Service URLs

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3001
- **LLM Service:** http://localhost:8000
- **Ollama:** http://localhost:11434

## 📝 License

MIT
