from fastapi import FastAPI, File, UploadFile, Form, HTTPException
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
from typing import Optional

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

def build_prompt(document_type: str, custom_fields: list = None):
    """Build dynamic prompt based on document type and custom fields"""
    
    # Base structure for all documents
    base_structure = {
        "invoice_number": "string or null",
        "invoice_date": "YYYY-MM-DD or null",
        "due_date": "YYYY-MM-DD or null",
        "vendor_name": "string or null",
        "vendor_address": "string or null",
        "customer_name": "string or null",
        "items": [
            {
                "description": "string",
                "quantity": "number",
                "unit_price": "number",
                "total": "number"
            }
        ],
        "subtotal": "number",
        "tax": "number",
        "total": "number",
        "currency": "string"
    }
    
    # Add custom fields to structure
    if custom_fields:
        for field in custom_fields:
            field_name = field.get("field", "").lower().replace(" ", "_")
            field_desc = field.get("description", "")
            if field_name:
                base_structure[field_name] = f"string or null - {field_desc}"
    
    # Document type specific instructions
    doc_type_instructions = {
        "invoice": "This is an INVOICE document. Focus on invoice-specific details.",
        "receipt": "This is a RECEIPT document. Focus on payment and transaction details.",
        "purchase_order": "This is a PURCHASE ORDER document. Focus on order details and terms.",
        "bill": "This is a BILL document. Focus on charges and payment due.",
        "other": "Extract all relevant financial information from this document."
    }
    
    instruction = doc_type_instructions.get(document_type, doc_type_instructions["other"])
    
    # Build custom fields instruction
    custom_fields_instruction = ""
    if custom_fields:
        custom_fields_instruction = "\n\nIMPORTANT - Extract these custom fields:\n"
        for field in custom_fields:
            field_name = field.get("field", "")
            field_desc = field.get("description", "")
            if field_name:
                custom_fields_instruction += f"- {field_name}: {field_desc}\n"
    
    # Build the complete prompt
    prompt = f"""{instruction}

Extract data from this document and return as JSON.
{custom_fields_instruction}
JSON format:
{json.dumps(base_structure, indent=2)}

Return only valid JSON, no explanation."""
    
    return prompt

def pdf_to_image(pdf_bytes):
    """Convert first page of PDF to image"""
    try:
        from pdf2image import convert_from_bytes
        
        print("📄 Converting PDF to image...")
        images = convert_from_bytes(
            pdf_bytes,
            first_page=1,
            last_page=1,
            dpi=150,
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
        raise Exception("pdf2image not installed. Run: pip install pdf2image")
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
    
    # Resize - smaller for better context fit
    max_size = 768  # Reduced from 1024
    if max(image.size) > max_size:
        ratio = max_size / max(image.size)
        new_size = tuple(int(dim * ratio) for dim in image.size)
        image = image.resize(new_size, Image.Resampling.LANCZOS)
        print(f"📏 Resized to: {image.size}")
    
    return image

def image_to_base64_safe(image):
    """Convert PIL Image to base64 - Multiple format attempts"""
    
    # Ensure RGB mode
    if image.mode != 'RGB':
        image = image.convert('RGB')
    
    # Try PNG first (more reliable with vision models)
    try:
        buffer = io.BytesIO()
        image.save(buffer, format='PNG', optimize=False)
        img_bytes = buffer.getvalue()
        
        print(f"✅ PNG created: {len(img_bytes):,} bytes")
        
        b64_string = base64.b64encode(img_bytes).decode('utf-8')
        print(f"✅ Base64 created: {len(b64_string):,} chars")
        
        return b64_string
    except Exception as e:
        print(f"⚠️ PNG encoding failed: {e}, trying JPEG...")
        
        # Fallback to JPEG
        buffer = io.BytesIO()
        
        # Save with specific JPEG settings for compatibility
        image.save(
            buffer, 
            format='JPEG',
            quality=85,
            optimize=False,
            progressive=False,
            subsampling=0
        )
        
        img_bytes = buffer.getvalue()
        
        # Verify it's a valid JPEG
        if not img_bytes.startswith(b'\xff\xd8'):
            raise Exception("Generated invalid JPEG (missing SOI marker)")
        
        print(f"✅ JPEG created: {len(img_bytes):,} bytes")
        
        b64_string = base64.b64encode(img_bytes).decode('utf-8')
        print(f"✅ Base64 created: {len(b64_string):,} chars")
        
        return b64_string

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
            "num_predict": 2000,
            "num_ctx": 8192,
            "top_p": 0.9
        }
    }
    
    print(f"🤖 Calling Ollama...")
    print(f"   Model: {MODEL_NAME}")
    print(f"   Image size: {len(image_base64):,} chars")
    print(f"   Prompt length: {len(prompt)} chars")
    
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
        raise HTTPException(status_code=504, detail="Ollama timeout (3 minutes)")
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Request failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

def clean_json_response(response_text):
    """Clean and extract JSON from LLM response"""
    response_text = response_text.strip()
    
    # Remove markdown code blocks
    if response_text.startswith("```json"):
        response_text = response_text[7:]
    elif response_text.startswith("```"):
        response_text = response_text[3:]
    
    if response_text.endswith("```"):
        response_text = response_text[:-3]
    
    response_text = response_text.strip()
    
    # Find JSON object
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
        "model": MODEL_NAME,
        "ollama_host": OLLAMA_HOST
    }

@app.get("/health")
async def health():
    """Health check endpoint"""
    try:
        response = requests.get(f"{OLLAMA_HOST}/api/tags", timeout=5)
        ollama_status = "connected" if response.status_code == 200 else "disconnected"
        
        # Try to get model info
        if response.status_code == 200:
            models = response.json().get("models", [])
            model_exists = any(m.get("name") == MODEL_NAME for m in models)
        else:
            model_exists = False
            
    except:
        ollama_status = "disconnected"
        model_exists = False
    
    return {
        "status": "healthy",
        "ollama_status": ollama_status,
        "model": MODEL_NAME,
        "model_available": model_exists
    }

@app.post("/test-image")
async def test_image(file: UploadFile = File(...)):
    """Test endpoint to verify image encoding works with Ollama"""
    print("\n" + "="*60)
    print("🧪 IMAGE ENCODING TEST")
    print("="*60)
    
    try:
        contents = await file.read()
        print(f"📎 File: {file.filename}")
        print(f"📦 Size: {len(contents):,} bytes")
        
        # Load image
        if file.content_type == "application/pdf":
            image = pdf_to_image(contents)
        else:
            image = Image.open(io.BytesIO(contents))
            if image.mode != 'RGB':
                image = image.convert('RGB')
        
        print(f"🖼️ Image: {image.size}, mode: {image.mode}")
        
        # Process
        image = process_image(image)
        
        # Encode
        image_base64 = image_to_base64_safe(image)
        
        # Test with simple prompt
        simple_prompt = "Describe what you see in this image in one sentence."
        
        print(f"\n🤖 Testing Ollama with simple prompt...")
        response_text = call_ollama_vision(image_base64, simple_prompt)
        
        print(f"\n✅ SUCCESS! Ollama responded:")
        print(response_text[:200])
        
        return JSONResponse(content={
            "success": True,
            "message": "Image encoding works!",
            "response_preview": response_text[:500]
        })
        
    except Exception as e:
        print(f"\n❌ TEST FAILED: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )

@app.post("/parse-invoice")
async def parse_invoice(
    file: UploadFile = File(...),
    document_type: str = Form("invoice"),
    custom_fields: Optional[str] = Form(None)
):
    """Main endpoint to parse invoice files (images or PDFs) with custom fields"""
    print("\n" + "="*60)
    print("📨 DOCUMENT PARSING REQUEST")
    print("="*60)
    
    try:
        # Parse custom fields if provided
        custom_fields_list = []
        if custom_fields:
            try:
                custom_fields_list = json.loads(custom_fields)
                print(f"🔧 Custom fields received: {len(custom_fields_list)}")
                for field in custom_fields_list:
                    print(f"   - {field.get('field')}: {field.get('description')}")
            except json.JSONDecodeError as e:
                print(f"⚠️  Failed to parse custom fields: {e}")
        
        # Validate file type
        allowed_types = ["image/jpeg", "image/png", "image/jpg", "application/pdf"]
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid file type: {file.content_type}. Allowed: {allowed_types}"
            )
        
        print(f"📎 File: {file.filename}")
        print(f"📋 Type: {file.content_type}")
        print(f"🏷️  Document Type: {document_type}")
        
        # Read file
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
            print(f"✅ Image loaded: {image.size}, mode: {image.mode}")
        
        # Process image
        print("\n🔧 Processing image...")
        image = process_image(image)
        
        # Convert to base64
        print("\n📦 Creating base64...")
        image_base64 = image_to_base64_safe(image)
        
        # Build dynamic prompt
        print("\n📝 Building prompt...")
        prompt = build_prompt(document_type, custom_fields_list)
        print(f"✅ Prompt built: {len(prompt)} chars")
        if custom_fields_list:
            print(f"   Including {len(custom_fields_list)} custom fields")
        
        # Call Ollama
        print("\n🤖 Sending to Ollama...")
        response_text = call_ollama_vision(image_base64, prompt)
        
        print("\n📝 Response received:")
        print(response_text[:500] + "..." if len(response_text) > 500 else response_text)
        
        # Parse JSON
        print("\n🔍 Parsing JSON...")
        cleaned = clean_json_response(response_text)
        
        try:
            parsed_data = json.loads(cleaned)
            print("✅ JSON parsed successfully")
            
            # Add metadata
            parsed_data["_metadata"] = {
                "filename": file.filename,
                "file_size_bytes": len(contents),
                "model_used": MODEL_NAME,
                "document_type": document_type,
                "custom_fields_count": len(custom_fields_list)
            }
            
        except json.JSONDecodeError as e:
            print(f"❌ JSON parse error: {e}")
            print(f"Attempted to parse: {cleaned[:200]}")
            
            # Return error structure
            parsed_data = {
                "error": "Failed to parse LLM response",
                "raw_response": response_text[:1000],
                "parse_error": str(e)
            }
        
        print("="*60)
        print("✅ COMPLETED")
        print("="*60 + "\n")
        
        return JSONResponse(content={
            "success": True,
            "data": parsed_data,
            "message": "Document parsed successfully"
        })
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return JSONResponse(
            status_code=500,
            content={
                "success": False, 
                "error": str(e),
                "message": "Internal server error"
            }
        )

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    print("\n" + "="*60)
    print("🚀 INVOICE PARSER LLM SERVER")
    print("="*60)
    print(f"📍 Port: {port}")
    print(f"🤖 Ollama: {OLLAMA_HOST}")
    print(f"🧠 Model: {MODEL_NAME}")
    print("="*60 + "\n")
    
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
