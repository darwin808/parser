from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import json
import uvicorn
from typing import Optional
import sys
from loguru import logger

import config
import image_utils
import llm_client

# ============ LOGGER SETUP ============
# Remove default handler
logger.remove()

# Add custom handler with formatting
logger.add(
    sys.stderr,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    level="INFO",
    colorize=True,
)

# Optional: Add file logging
logger.add(
    "logs/llm-server_{time:YYYY-MM-DD}.log",
    rotation="00:00",  # New file at midnight
    retention="7 days",  # Keep logs for 7 days
    compression="zip",  # Compress old logs
    level="DEBUG",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
)

app = FastAPI(title="Invoice Parser")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============ MIDDLEWARE FOR REQUEST LOGGING ============
@app.middleware("http")
async def log_requests(request, call_next):
    logger.info(f"📨 {request.method} {request.url.path}")
    try:
        response = await call_next(request)
        logger.info(f"✅ {request.method} {
                    request.url.path} - Status: {response.status_code}")
        return response
    except Exception as e:
        logger.error(f"❌ {request.method} {
                     request.url.path} - Error: {str(e)}")
        raise


@app.get("/")
async def root():
    logger.debug("Root endpoint called")
    return {
        "service": "Invoice Parser",
        "status": "running",
        "model": config.MODEL_NAME
    }


@app.get("/health")
async def health():
    logger.debug("Health check initiated")
    health_info = llm_client.check_ollama_health()

    logger.info(f"Health check - Ollama: {health_info['status']}, Model available: {
                health_info['model_available']}")

    return {
        "status": "healthy",
        "ollama_status": health_info["status"],
        "model": config.MODEL_NAME,
        "model_available": health_info["model_available"]
    }


@app.post("/test-image")
async def test_image(file: UploadFile = File(...)):
    """Test image encoding"""
    try:
        contents = await file.read()
        logger.info(f"🖼️  Testing image: {
                    file.filename} ({len(contents):,} bytes)")

        # Process image
        image_base64 = image_utils.load_and_prepare_image(
            contents, file.content_type)
        logger.debug(f"Image processed, base64 length: {len(image_base64)}")

        # Simple test
        prompt = "Describe this image in one sentence."
        logger.debug("Calling Ollama for test...")
        response = llm_client.call_ollama(image_base64, prompt)

        logger.success(f"✅ Test successful for {file.filename}")

        return {
            "success": True,
            "message": "Works!",
            "response": response[:500]
        }
    except Exception as e:
        logger.error(f"❌ Test failed for {file.filename}: {str(e)}")
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.post("/parse-invoice")
async def parse_invoice(
    file: UploadFile = File(...),
    document_type: str = Form("invoice"),
    custom_fields: Optional[str] = Form(None)
):
    """Parse invoice/document"""
    logger.info("=" * 60)
    logger.info(f"📄 Starting parse: {file.filename}")
    logger.info(f"📋 Document type: {document_type}")
    logger.info("=" * 60)

    try:
        # Parse custom fields
        custom_fields_list = []
        if custom_fields:
            try:
                custom_fields_list = json.loads(custom_fields)
                logger.info(f"🔧 Custom fields: {len(custom_fields_list)}")
            except Exception as e:
                logger.warning(f"Failed to parse custom fields: {str(e)}")

        # Validate file type
        if file.content_type not in config.ALLOWED_TYPES:
            logger.error(f"❌ Invalid file type: {file.content_type}")
            raise HTTPException(400, f"Invalid file type: {file.content_type}")

        # Read file
        contents = await file.read()
        logger.info(f"📦 File size: {len(contents):,} bytes")

        # Process image
        logger.debug("🖼️  Processing image...")
        image_base64 = image_utils.load_and_prepare_image(
            contents, file.content_type)
        logger.success(f"✅ Image processed, base64 length: {
                       len(image_base64):,}")

        # Build prompt
        prompt = llm_client.build_prompt(document_type, custom_fields_list)
        logger.info(f"📝 Prompt built: {len(prompt)} characters")

        # Call LLM
        logger.info(f"🤖 Calling Ollama with model: {config.MODEL_NAME}...")
        response_text = llm_client.call_ollama(image_base64, prompt)
        logger.info(f"✅ LLM response received: {
                    len(response_text)} characters")

        # Parse JSON
        logger.debug("🔍 Parsing JSON response...")
        cleaned = llm_client.clean_json(response_text)

        try:
            data = json.loads(cleaned)
            logger.success(f"✅ JSON parsed successfully")

            # Add metadata
            data["_metadata"] = {
                "filename": file.filename,
                "size": len(contents),
                "model": config.MODEL_NAME,
                "type": document_type
            }

            logger.info(f"🎉 Parse completed successfully for {file.filename}")

        except json.JSONDecodeError as e:
            logger.error(f"❌ JSON decode error: {str(e)}")
            logger.debug(f"Cleaned response: {cleaned[:500]}")
            data = {
                "error": "Failed to parse response",
                "raw": response_text[:1000]
            }

        return {
            "success": True,
            "data": data,
            "message": "Parsed successfully"
        }

    except HTTPException as e:
        logger.error(f"❌ HTTP Exception: {e.detail}")
        raise
    except Exception as e:
        logger.exception(f"❌ Unexpected error during parse: {str(e)}")
        return JSONResponse(status_code=500, content={
            "success": False,
            "error": str(e)
        })


if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("🚀 Invoice Parser Server Starting")
    logger.info("=" * 60)
    logger.info(f"📍 Port: {config.PORT}")
    logger.info(f"🤖 Model: {config.MODEL_NAME}")
    logger.info(f"🔗 Ollama Host: {config.OLLAMA_HOST}")
    logger.info("=" * 60)

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=config.PORT,
        log_level="info"
    )
