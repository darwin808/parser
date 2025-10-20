import requests
import json
from fastapi import HTTPException
import config


def build_prompt(document_type, custom_fields=None):
    """Build prompt for document parsing"""
    base = {
        "invoice_number": "string or null",
        "invoice_date": "YYYY-MM-DD or null",
        "due_date": "YYYY-MM-DD or null",
        "vendor_name": "string or null",
        "vendor_address": "string or null",
        "customer_name": "string or null",
        "items": [{"description": "string", "quantity": "number",
                   "unit_price": "number", "total": "number"}],
        "subtotal": "number",
        "tax": "number",
        "total": "number",
        "currency": "string"
    }

    # Add custom fields
    if custom_fields:
        for field in custom_fields:
            name = field.get("field", "").lower().replace(" ", "_")
            desc = field.get("description", "")
            if name:
                base[name] = f"string or null - {desc}"

    doc_instructions = {
        "invoice": "This is an INVOICE. Focus on invoice details.",
        "receipt": "This is a RECEIPT. Focus on payment details.",
        "purchase_order": "This is a PURCHASE ORDER. Focus on order details.",
        "bill": "This is a BILL. Focus on charges.",
        "other": "Extract financial information."
    }

    instruction = doc_instructions.get(
        document_type, doc_instructions["other"])

    prompt = f"""{instruction}

Extract data and return as JSON.

JSON format:
{json.dumps(base, indent=2)}

Return only valid JSON, no explanation."""

    return prompt


def call_ollama(image_base64, prompt):
    """Call Ollama API"""
    url = f"{config.OLLAMA_HOST}/api/generate"

    payload = {
        "model": config.MODEL_NAME,
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

    try:
        response = requests.post(url, json=payload, timeout=180)

        if response.status_code != 200:
            raise HTTPException(status_code=500,
                                detail=f"Ollama error: {response.text}")

        return response.json().get("response", "")

    except requests.Timeout:
        raise HTTPException(status_code=504, detail="Ollama timeout")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def clean_json(text):
    """Extract JSON from response"""
    text = text.strip()

    # Remove markdown
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]

    text = text.strip()

    # Extract JSON object
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1:
        text = text[start:end+1]

    return text


def check_ollama_health():
    """Check if Ollama is running"""
    try:
        response = requests.get(f"{config.OLLAMA_HOST}/api/tags", timeout=5)
        if response.status_code == 200:
            models = response.json().get("models", [])
            model_available = any(
                m.get("name") == config.MODEL_NAME for m in models)
            return {"status": "connected", "model_available": model_available}
    except:
        pass
    return {"status": "disconnected", "model_available": False}
