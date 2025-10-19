from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from PIL import Image
import io
import json
import os
import base64
import requests
from dotenv import load_dotenv
import tempfile

load_dotenv()

app = FastAPI(title="Invoice Parser LLM Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
MODEL_NAME = os.getenv("MODEL_NAME", "qwen2.5vl:latest")

INVOICE_PROMPT = """You are an expert at extracting structured data from invoice images.

Analyze this invoice image carefully and extract ALL visible information. Return ONLY a valid JSON object with no additional text, explanation, or markdown formatting.

Required JSON structure:
{
  "invoice_number": "string or null",
  "invoice_date": "YYYY-MM-DD or null",
  "due_date": "YYYY-MM-DD or null",
  "vendor_name": "string or null",
  "vendor_address": "string or null",
  "vendor_phone": "string or null",
  "vendor_email": "string or null",
  "customer_name": "string or null",
  "customer_address": "string or null",
  "items": [
    {
      "description": "string",
      "quantity": number,
      "unit_price": number,
      "total": number
    }
  ],
  "subtotal": number,
  "tax": number,
  "tax_rate": number,
  "discount": number,
  "total": number,
  "currency": "string (USD, EUR, PHP, etc.)",
  "payment_terms": "string or null",
  "notes": "string or null"
}

CRITICAL INSTRUCTIONS:
- Extract ALL line items from the invoice
- Use null for fields that are not found
- All numeric fields must be numbers, not strings
- Date format: YYYY-MM-DD
- Return ONLY the JSON object, no markdown blocks, no explanations
"""

def pdf_to_image(pdf_bytes):
    """Convert first page of PDF to image"""
    try:
        from pdf2image import convert_from_bytes
        
        print("📄 Converting PDF to image...")
        images = convert_from_bytes(
            pdf_bytes,
            first_page=1,
            last_page=1,
            dpi=150,  # Lower DPI for smaller file
            fmt='jpeg'
        )
        
        if not images:
            raise Exception("No pages found in PDF")
        
        image = images[0]
        
        # Force RGB mode
        if image.mode != 'RGB':
            print(f"Converting from {image.mode} to RGB")
            image = image.convert('RGB')
            
        print(f"✅ PDF converted: {image.size}, mode: {image.mode}")
        return image
        
    except ImportError:
        raise Exception("pdf2image not installed")
    except Exception as e:
        raise Exception(f"PDF conversion failed: {str(e)}")

def process_image(image):
    """Process and optimize image for LLM"""
    # Force RGB
    if image.mode != 'RGB':
        print(f"Converting {image.mode} to RGB")
        if image.mode in ('RGBA', 'LA'):
            background = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'RGBA':
                background.paste(image, mask=image.split()[3])
            else:
                background.paste(image, mask=image.split()[1])
            image = background
        else:
            image = image.convert('RGB')
    
    # Resize if needed
    max_size = 1536  # Smaller size
    if max(image.size) > max_size:
        ratio = max_size / max(image.size)
        new_size = tuple(int(dim * ratio) for dim in image.size)
        image = image.resize(new_size, Image.Resampling.LANCZOS)
        print(f"📏 Resized to: {image.size}")
    
    return image

def image_to_base64_safe(image):
    """Convert image to base64 with validation"""
    # Save to temporary file first to ensure valid JPEG
    with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
        tmp_path = tmp.name
        
    try:
        # Save as JPEG
        image.save(tmp_path, 'JPEG', quality=85, optimize=True)
        
        # Read back and verify
        with Image.open(tmp_path) as verify_img:
            verify_img.verify()
        
        # Read the file
        with open(tmp_path, 'rb') as f:
            img_bytes = f.read()
        
        print(f"✅ Valid JPEG created: {len(img_bytes)} bytes")
        
        # Convert to base64
        b64 = base64.b64encode(img_bytes).decode('utf-8')
        
        return b64
        
    finally:
        # Clean up temp file
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)

def call_ollama_vision(image_base64, prompt):
    """Call Ollama API with vision model"""
    url = f"{OLLAMA_HOST}/api/generate"
    
    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "images": [image_base64],
        "stream": False,
        "options": {
            "temperature": 0.1,
            "num_predict": 3000
        }
    }
    
    print(f"🤖 Calling Ollama...")
    print(f"   Model: {MODEL_NAME}")
    print(f"   Image size: {len(image_base64)} chars")
    
    try:
        response = requests.post(url, json=payload, timeout=180)
        
        if response.status_code != 200:
            error_text = response.text
            print(f"❌ Ollama returned {response.status_code}")
            print(f"   Error: {error_text}")
            raise HTTPException(
                status_code=500,
                detail=f"Ollama error: {error_text}"
            )
        
        result = response.json()
        print("✅ Ollama responded successfully")
        return result.get("response", "")
        
    except requests.Timeout:
        raise HTTPException(status_code=504, detail="Ollama timeout")
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Request failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

def clean_json_response(response_text):
    """Clean and extract JSON"""
    response_text = response_text.strip()
    
    if response_text.startswith("```json"):
        response_text = response_text[7:]
    elif response_text.startswith("```"):
        response_text = response_text[3:]
    
    if response_text.endswith("```"):
        response_text = response_text[:-3]
    
    response_text = response_text.strip()
    
    start = response_text.find('{')
    end = response_text.rfind('}')
    
    if start != -1 and end != -1:
        response_text = response_text[start:end+1]
    
    return response_text

@app.get("/")
async def root():
    return {
        "service": "Invoice Parser LLM Server",
        "status": "running",
        "model": MODEL_NAME
    }

@app.get("/health")
async def health():
    try:
        response = requests.get(f"{OLLAMA_HOST}/api/tags", timeout=5)
        ollama_status = "connected" if response.status_code == 200 else "disconnected"
    except:
        ollama_status = "disconnected"
    
    return {
        "status": "healthy",
        "ollama_status": ollama_status,
        "model": MODEL_NAME
    }

@app.post("/parse-invoice")
async def parse_invoice(file: UploadFile = File(...)):
    print("\n" + "="*60)
    print("📨 INVOICE PARSING REQUEST")
    print("="*60)
    
    try:
        allowed_types = ["image/jpeg", "image/png", "image/jpg", "application/pdf"]
        if file.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail="Invalid file type")
        
        print(f"📎 File: {file.filename}")
        print(f"📋 Type: {file.content_type}")
        
        contents = await file.read()
        print(f"📦 Size: {len(contents):,} bytes")
        
        # Convert to image
        if file.content_type == "application/pdf":
            print("\n🔄 Converting PDF...")
            image = pdf_to_image(contents)
        else:
            print("\n🔄 Loading image...")
            image = Image.open(io.BytesIO(contents))
            if image.mode != 'RGB':
                print(f"Converting {image.mode} to RGB")
                image = image.convert('RGB')
            print(f"✅ Image loaded: {image.size}")
        
        # Process
        print("\n🔧 Processing image...")
        image = process_image(image)
        
        # Convert to base64
        print("\n📦 Creating base64...")
        image_base64 = image_to_base64_safe(image)
        
        # Call Ollama
        print("\n🤖 Calling Ollama...")
        response_text = call_ollama_vision(image_base64, INVOICE_PROMPT)
        
        print("\n📝 Response received:")
        print(response_text[:500])
        
        # Parse
        cleaned = clean_json_response(response_text)
        
        try:
            parsed_data = json.loads(cleaned)
            print("✅ JSON parsed successfully")
        except json.JSONDecodeError as e:
            print(f"❌ JSON parse error: {e}")
            parsed_data = {
                "invoice_number": "ERROR",
                "vendor_name": "Parse failed",
                "items": [],
                "total": 0,
                "currency": "USD"
            }
        
        print("="*60)
        print("✅ COMPLETED")
        print("="*60 + "\n")
        
        return JSONResponse(content={
            "success": True,
            "data": parsed_data,
            "message": "Success"
        })
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    print("\n" + "="*60)
    print("🚀 LLM SERVER")
    print("="*60)
    print(f"Port: {port}")
    print(f"Ollama: {OLLAMA_HOST}")
    print(f"Model: {MODEL_NAME}")
    print("="*60 + "\n")
    
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
