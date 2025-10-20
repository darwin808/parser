from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import json
import uvicorn
from typing import Optional

import config
import image_utils
import llm_client

app = FastAPI(title="Invoice Parser")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "service": "Invoice Parser",
        "status": "running",
        "model": config.MODEL_NAME
    }


@app.get("/health")
async def health():
    health_info = llm_client.check_ollama_health()
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
        print(f"Testing: {file.filename}")

        # Process image
        image_base64 = image_utils.load_and_prepare_image(
            contents, file.content_type)

        # Simple test
        prompt = "Describe this image in one sentence."
        response = llm_client.call_ollama(image_base64, prompt)

        return {
            "success": True,
            "message": "Works!",
            "response": response[:500]
        }
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.post("/parse-invoice")
async def parse_invoice(
    file: UploadFile = File(...),
    document_type: str = Form("invoice"),
    custom_fields: Optional[str] = Form(None)
):
    """Parse invoice/document"""
    print("\n" + "="*50)
    print(f"📨 Parsing: {file.filename}")
    print("="*50)

    try:
        # Parse custom fields
        custom_fields_list = []
        if custom_fields:
            try:
                custom_fields_list = json.loads(custom_fields)
                print(f"Custom fields: {len(custom_fields_list)}")
            except:
                pass

        # Validate file type
        if file.content_type not in config.ALLOWED_TYPES:
            raise HTTPException(400, f"Invalid file type: {file.content_type}")

        # Read file
        contents = await file.read()
        print(f"Size: {len(contents):,} bytes")

        # Process image
        image_base64 = image_utils.load_and_prepare_image(
            contents, file.content_type)

        # Build prompt
        prompt = llm_client.build_prompt(document_type, custom_fields_list)
        print(f"Prompt: {len(prompt)} chars")

        # Call LLM
        print("Calling Ollama...")
        response_text = llm_client.call_ollama(image_base64, prompt)

        # Parse JSON
        cleaned = llm_client.clean_json(response_text)
        try:
            data = json.loads(cleaned)
            print("✅ Success")

            # Add metadata
            data["_metadata"] = {
                "filename": file.filename,
                "size": len(contents),
                "model": config.MODEL_NAME,
                "type": document_type
            }
        except json.JSONDecodeError as e:
            print(f"JSON error: {e}")
            data = {
                "error": "Failed to parse response",
                "raw": response_text[:1000]
            }

        return {
            "success": True,
            "data": data,
            "message": "Parsed successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error: {e}")
        return JSONResponse(status_code=500, content={
            "success": False,
            "error": str(e)
        })


if __name__ == "__main__":
    print("\n🚀 Invoice Parser Server")
    print(f"Port: {config.PORT}")
    print(f"Model: {config.MODEL_NAME}\n")

    uvicorn.run(app, host="0.0.0.0", port=config.PORT)
