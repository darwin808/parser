import requests
import json
from fastapi import HTTPException
from loguru import logger
import config


def get_base_structure(document_type):
    """Get base structure based on document type"""

    # Base fields for invoices
    invoice_base = {
        "invoice_number": "string or null",
        "invoice_date": "YYYY-MM-DD or null",
        "due_date": "YYYY-MM-DD or null",
        "vendor_name": "string or null",
        "vendor_address": "string or null",
        "customer_name": "string or null",
        "customer_address": "string or null",
        "items": [{"description": "string", "quantity": "number",
                   "unit_price": "number", "total": "number"}],
        "subtotal": "number",
        "tax": "number",
        "total": "number",
        "currency": "string"
    }

    # Base fields for receipts
    receipt_base = {
        "receipt_number": "string or null",
        "transaction_date": "YYYY-MM-DD or null",
        "transaction_time": "HH:MM:SS or null",
        "merchant_name": "string or null",
        "merchant_address": "string or null",
        "payment_method": "string or null (cash, card, etc)",
        "card_last_4": "string or null",
        "items": [{"description": "string", "quantity": "number",
                   "unit_price": "number", "total": "number"}],
        "subtotal": "number",
        "tax": "number",
        "tip": "number or null",
        "total": "number",
        "currency": "string"
    }

    # Map document types to their base structures
    structures = {
        "invoice": invoice_base,
        "receipt": receipt_base,
        "purchase_order": invoice_base,  # Similar to invoice
        "bill": invoice_base  # Similar to invoice
    }

    return structures.get(document_type, invoice_base)


def build_prompt(document_type, custom_fields=None):
    """Build prompt for document parsing"""
    logger.debug(f"Building prompt for document_type: {
                 document_type}, custom_fields: {bool(custom_fields)}")

    # If custom fields provided, use them exclusively
    if custom_fields:
        base = {}
        for field in custom_fields:
            name = field.get("field", "").lower().replace(" ", "_")
            desc = field.get("description", "")
            if name:
                base[name] = f"string or null - {desc}"

        instruction = "Extract the following custom fields from this document:"
        logger.info(f"Using {len(custom_fields)} custom fields")

    # If document_type is None or "auto", let LLM decide what to extract
    elif document_type is None or document_type == "auto":
        instruction = """Analyze this document and determine its type (invoice, receipt, purchase order, bill, etc).
Extract ALL relevant financial information you can find in the document.
Include fields like: document number, dates, vendor/merchant info, customer info, items, amounts, taxes, totals, payment details, etc."""

        # Use a flexible base structure
        base = {
            "document_type": "string - detected type (invoice, receipt, etc)",
            "document_number": "string or null",
            "date": "YYYY-MM-DD or null",
            "vendor_or_merchant": "string or null",
            "customer": "string or null",
            "items": [{"description": "string", "quantity": "number",
                       "unit_price": "number", "total": "number"}],
            "subtotal": "number or null",
            "tax": "number or null",
            "total": "number",
            "currency": "string or null",
            "additional_fields": "object - any other relevant information found"
        }
        logger.info("Using auto-detect mode")

    # Use predefined base structure for specific document types
    else:
        base = get_base_structure(document_type)

        doc_instructions = {
            "invoice": "This is an INVOICE. Extract invoice-specific details.",
            "receipt": "This is a RECEIPT. Extract payment and transaction details.",
            "purchase_order": "This is a PURCHASE ORDER. Extract order details and terms.",
            "bill": "This is a BILL. Extract billing charges and payment information."
        }

        instruction = doc_instructions.get(document_type,
                                           "Extract all relevant financial information from this document.")
        logger.info(f"Using predefined structure for: {document_type}")

    prompt = f"""{instruction}

Extract data and return as JSON.

JSON format:
{json.dumps(base, indent=2)}

Return only valid JSON, no explanation."""

    logger.debug(f"Prompt generated: {len(prompt)} chars")
    return prompt


def call_ollama(image_base64, prompt):
    """Call Ollama API"""
    url = f"{config.OLLAMA_HOST}/api/generate"

    logger.debug(f"Calling Ollama at: {url}")
    logger.debug(f"Model: {config.MODEL_NAME}")
    logger.debug(f"Image size: {len(image_base64):,} chars")
    logger.debug(f"Prompt size: {len(prompt)} chars")

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
        logger.info("🤖 Sending request to Ollama...")
        response = requests.post(url, json=payload, timeout=180)

        if response.status_code != 200:
            logger.error(f"❌ Ollama returned status {
                         response.status_code}: {response.text[:500]}")
            raise HTTPException(status_code=500,
                                detail=f"Ollama error: {response.text}")

        response_data = response.json()
        response_text = response_data.get("response", "")

        logger.success(f"✅ Ollama response received: {
                       len(response_text)} chars")
        logger.debug(f"Response preview: {response_text[:200]}...")

        return response_text

    except requests.Timeout:
        logger.error("❌ Ollama request timeout (180s)")
        raise HTTPException(status_code=504, detail="Ollama timeout")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"❌ Unexpected error calling Ollama: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def clean_json(text):
    """Extract JSON from response"""
    original_length = len(text)
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
        logger.debug(f"JSON extracted from response (original: {
                     original_length} -> cleaned: {len(text)} chars)")
    else:
        logger.warning("No JSON object found in response")

    return text


def check_ollama_health():
    """Check if Ollama is running"""
    logger.debug(f"Checking Ollama health at: {config.OLLAMA_HOST}")

    try:
        response = requests.get(f"{config.OLLAMA_HOST}/api/tags", timeout=5)
        if response.status_code == 200:
            models = response.json().get("models", [])
            model_available = any(
                m.get("name") == config.MODEL_NAME for m in models)

            if model_available:
                logger.success(f"✅ Ollama connected, model '{
                               config.MODEL_NAME}' available")
            else:
                logger.warning(f"⚠️  Ollama connected, but model '{
                               config.MODEL_NAME}' not found")
                logger.info(f"Available models: {
                            [m.get('name') for m in models]}")

            return {"status": "connected", "model_available": model_available}
    except Exception as e:
        logger.error(f"❌ Ollama health check failed: {str(e)}")

    return {"status": "disconnected", "model_available": False}
