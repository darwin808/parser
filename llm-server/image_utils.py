from PIL import Image
import io
import base64
import config


def pdf_to_image(pdf_bytes):
    """Convert PDF to image"""
    try:
        from pdf2image import convert_from_bytes
        images = convert_from_bytes(pdf_bytes, first_page=1, last_page=1,
                                    dpi=config.IMAGE_DPI, fmt='jpeg')
        if not images:
            raise Exception("No pages in PDF")

        image = images[0]
        if image.mode != 'RGB':
            image = image.convert('RGB')
        return image
    except ImportError:
        raise Exception("pdf2image not installed")
    except Exception as e:
        raise Exception(f"PDF conversion failed: {e}")


def process_image(image):
    """Resize and convert to RGB"""
    # Force RGB
    if image.mode != 'RGB':
        if image.mode in ('RGBA', 'LA'):
            bg = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'RGBA':
                bg.paste(image, mask=image.split()[3])
            else:
                bg.paste(image, mask=image.split()[1])
            image = bg
        else:
            image = image.convert('RGB')

    # Resize if needed
    if max(image.size) > config.MAX_IMAGE_SIZE:
        ratio = config.MAX_IMAGE_SIZE / max(image.size)
        new_size = tuple(int(dim * ratio) for dim in image.size)
        image = image.resize(new_size, Image.Resampling.LANCZOS)

    return image


def image_to_base64(image):
    """Convert image to base64"""
    if image.mode != 'RGB':
        image = image.convert('RGB')

    buffer = io.BytesIO()
    image.save(buffer, format='PNG', optimize=False)
    return base64.b64encode(buffer.getvalue()).decode('utf-8')


def load_and_prepare_image(file_bytes, content_type):
    """Complete pipeline: load, process, encode"""
    # Load
    if content_type == "application/pdf":
        image = pdf_to_image(file_bytes)
    else:
        image = Image.open(io.BytesIO(file_bytes))
        if image.mode != 'RGB':
            image = image.convert('RGB')

    # Process
    image = process_image(image)

    # Encode
    return image_to_base64(image)
