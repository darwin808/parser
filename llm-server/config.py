import os
from dotenv import load_dotenv

load_dotenv()

# Server
PORT = int(os.getenv("PORT", 8000))

# Ollama
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
MODEL_NAME = os.getenv("MODEL_NAME", "qwen2.5vl:latest")

# Image settings
MAX_IMAGE_SIZE = 768
IMAGE_DPI = 150

# Allowed file types
ALLOWED_TYPES = ["image/jpeg", "image/png", "image/jpg", "application/pdf"]
