.PHONY: help dev build start stop clean install logs test

# Colors
CYAN := \033[0;36m
YELLOW := \033[1;33m
GREEN := \033[0;32m
RED := \033[0;31m
NC := \033[0m

help: ## Show this help message
	@echo "$(CYAN)╔════════════════════════════════════════╗$(NC)"
	@echo "$(CYAN)║   Invoice Parser System Commands      ║$(NC)"
	@echo "$(CYAN)╚════════════════════════════════════════╝$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""

# Development Commands
dev: ## 🚀 Start all services in dev mode
	@echo "$(GREEN)🚀 Starting all services...$(NC)"
	@npm run dev

dev-next: ## Start Next.js only
	@echo "$(CYAN)Starting Next.js...$(NC)"
	@cd frontend && npm run dev

dev-express: ## Start Express only
	@echo "$(CYAN)Starting Express...$(NC)"
	@cd backend && npm run dev

dev-python: ## Start Python LLM only
	@echo "$(CYAN)Starting Python LLM...$(NC)"
	@cd llm-server && /opt/anaconda3/bin/python app.py

# Installation Commands
install: ## 📦 Install all dependencies
	@echo "$(GREEN)📦 Installing dependencies...$(NC)"
	@echo "$(CYAN)Installing root dependencies...$(NC)"
	@npm install
	@echo "$(CYAN)Installing frontend dependencies...$(NC)"
	@cd frontend && npm install
	@echo "$(CYAN)Installing backend dependencies...$(NC)"
	@cd backend && npm install
	@echo "$(CYAN)Installing Python dependencies...$(NC)"
	@cd llm-server && /opt/anaconda3/bin/pip install -r requirements.txt
	@echo "$(GREEN)✅ All dependencies installed!$(NC)"

install-next: ## Install Next.js dependencies only
	@cd frontend && npm install

install-express: ## Install Express dependencies only
	@cd backend && npm install

install-python: ## Install Python dependencies only
	@cd llm-server && /opt/anaconda3/bin/pip install -r requirements.txt

# Build Commands
build: ## 🔨 Build all services
	@echo "$(GREEN)🔨 Building all services...$(NC)"
	@cd frontend && npm run build
	@cd backend && npm run build
	@echo "$(GREEN)✅ Build complete!$(NC)"

build-next: ## Build Next.js only
	@cd frontend && npm run build

build-express: ## Build Express only
	@cd backend && npm run build

# Start Commands
start: ## 🎬 Start all services (production)
	@echo "$(GREEN)🎬 Starting production servers...$(NC)"
	@npm run start

# Clean Commands
clean: ## 🧹 Clean all build artifacts
	@echo "$(YELLOW)🧹 Cleaning build artifacts...$(NC)"
	@rm -rf frontend/.next frontend/node_modules
	@rm -rf backend/dist backend/node_modules
	@find llm-server -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	@find llm-server -name "*.pyc" -delete 2>/dev/null || true
	@rm -rf node_modules
	@echo "$(GREEN)✅ Cleaned!$(NC)"

clean-next: ## Clean Next.js only
	@rm -rf frontend/.next frontend/node_modules

clean-express: ## Clean Express only
	@rm -rf backend/dist backend/node_modules

clean-python: ## Clean Python cache
	@find llm-server -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	@find llm-server -name "*.pyc" -delete 2>/dev/null || true

# Test Commands
test: ## 🧪 Run all tests
	@echo "$(GREEN)🧪 Running all tests...$(NC)"
	@cd frontend && npm test || true
	@cd backend && npm test || true
	@cd llm-server && pytest || true

test-next: ## Test Next.js only
	@cd frontend && npm test

test-express: ## Test Express only
	@cd backend && npm test

test-python: ## Test Python only
	@cd llm-server && pytest

# Lint Commands
lint: ## 🔍 Lint all code
	@echo "$(GREEN)🔍 Linting all code...$(NC)"
	@cd frontend && npm run lint || true
	@cd backend && npm run lint || true
	@cd llm-server && pylint *.py || true

lint-next: ## Lint Next.js only
	@cd frontend && npm run lint

lint-express: ## Lint Express only
	@cd backend && npm run lint

lint-python: ## Lint Python only
	@cd llm-server && pylint *.py

# Logs
logs: ## 📋 Show logs from all services
	@echo "$(CYAN)Showing logs...$(NC)"
	@tail -f frontend/logs/*.log backend/logs/*.log llm-server/logs/*.log 2>/dev/null || echo "No log files found"

# Utility Commands
ports-check: ## 🔍 Check if ports are available
	@echo "$(CYAN)Checking ports...$(NC)"
	@echo -n "Port 3000 (Next.js): "
	@lsof -i:3000 > /dev/null 2>&1 && echo "$(YELLOW)⚠️  IN USE$(NC)" || echo "$(GREEN)✅ Available$(NC)"
	@echo -n "Port 3001 (Express): "
	@lsof -i:3001 > /dev/null 2>&1 && echo "$(YELLOW)⚠️  IN USE$(NC)" || echo "$(GREEN)✅ Available$(NC)"
	@echo -n "Port 8000 (Python):  "
	@lsof -i:8000 > /dev/null 2>&1 && echo "$(YELLOW)⚠️  IN USE$(NC)" || echo "$(GREEN)✅ Available$(NC)"
	@echo -n "Port 11434 (Ollama): "
	@lsof -i:11434 > /dev/null 2>&1 && echo "$(YELLOW)⚠️  IN USE$(NC)" || echo "$(GREEN)✅ Available$(NC)"

ports-kill: ## 🔪 Kill processes on default ports
	@echo "$(YELLOW)🔪 Killing processes on ports...$(NC)"
	@lsof -ti:3000 | xargs kill -9 2>/dev/null && echo "Killed port 3000" || echo "Port 3000 free"
	@lsof -ti:3001 | xargs kill -9 2>/dev/null && echo "Killed port 3001" || echo "Port 3001 free"
	@lsof -ti:8000 | xargs kill -9 2>/dev/null && echo "Killed port 8000" || echo "Port 8000 free"
	@echo "$(GREEN)✅ Ports cleared!$(NC)"

status: ## 📊 Show status of all services
	@echo "$(CYAN)╔════════════════════════════╗$(NC)"
	@echo "$(CYAN)║    Service Status          ║$(NC)"
	@echo "$(CYAN)╚════════════════════════════╝$(NC)"
	@echo ""
	@echo -n "Next.js (3000):  "
	@curl -s http://localhost:3000 > /dev/null 2>&1 && echo "$(GREEN)✅ Running$(NC)" || echo "$(RED)❌ Stopped$(NC)"
	@echo -n "Express (3001):  "
	@curl -s http://localhost:3001 > /dev/null 2>&1 && echo "$(GREEN)✅ Running$(NC)" || echo "$(RED)❌ Stopped$(NC)"
	@echo -n "Python (8000):   "
	@curl -s http://localhost:8000 > /dev/null 2>&1 && echo "$(GREEN)✅ Running$(NC)" || echo "$(RED)❌ Stopped$(NC)"
	@echo -n "Ollama (11434):  "
	@curl -s http://localhost:11434/api/tags > /dev/null 2>&1 && echo "$(GREEN)✅ Running$(NC)" || echo "$(RED)❌ Stopped$(NC)"
	@echo ""

# Ollama Commands
ollama-check: ## Check if Ollama is running
	@curl -s http://localhost:11434/api/tags > /dev/null && echo "$(GREEN)✅ Ollama is running$(NC)" || echo "$(RED)❌ Ollama is not running. Start: ollama serve$(NC)"

ollama-pull: ## Pull required Ollama model
	@echo "$(CYAN)Pulling qwen2.5vl:latest...$(NC)"
	@ollama pull qwen2.5vl:latest

ollama-list: ## List installed Ollama models
	@ollama list

# Setup Command
setup: install ollama-check ## 🎯 Complete first-time setup
	@echo ""
	@echo "$(GREEN)╔════════════════════════════════════════╗$(NC)"
	@echo "$(GREEN)║  ✅ Setup Complete!                    ║$(NC)"
	@echo "$(GREEN)╚════════════════════════════════════════╝$(NC)"
	@echo ""
	@echo "$(YELLOW)Next steps:$(NC)"
	@echo "  1. Make sure your projects are in the right folders"
	@echo "  2. Start all services: $(CYAN)make dev$(NC)"
	@echo "  3. Check status: $(CYAN)make status$(NC)"
	@echo ""

# Quick restart
restart: ports-kill dev ## 🔄 Kill ports and restart all services

# Info
info: ## ℹ️  Show project information
	@echo "$(CYAN)╔════════════════════════════════════════╗$(NC)"
	@echo "$(CYAN)║   Invoice Parser System Info           ║$(NC)"
	@echo "$(CYAN)╚════════════════════════════════════════╝$(NC)"
	@echo ""
	@echo "$(YELLOW)Services:$(NC)"
	@echo "  Next.js Frontend:  http://localhost:3000"
	@echo "  Express Backend:   http://localhost:3001"
	@echo "  Python LLM:        http://localhost:8000"
	@echo "  Ollama:            http://localhost:11434"
	@echo ""
	@echo "$(YELLOW)Project Structure:$(NC)"
	@echo "  frontend/     - Next.js application"
	@echo "  backend/      - Express API server"
	@echo "  llm-server/  - Python FastAPI with Ollama"
	@echo "  shared/       - Shared types and utilities"
	@echo ""
	@echo "$(YELLOW)Common Commands:$(NC)"
	@echo "  make dev      - Start all services"
	@echo "  make status   - Check service status"
	@echo "  make restart  - Restart all services"
	@echo "  make help     - Show all commands"
	@echo ""
