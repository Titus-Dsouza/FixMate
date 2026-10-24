"""Input validation helpers for uploaded complaint and repair images."""

import uuid
import warnings

from django.core.exceptions import ValidationError
from PIL import Image, UnidentifiedImageError

MAX_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_IMAGE_FORMATS = {
    "JPEG": "jpg",
    "PNG": "png",
    "WEBP": "webp",
}


def validate_image_upload(upload):
    """Accept only small, decodable JPEG, PNG, or WebP images.

    Browser-provided MIME types and file names are untrusted, so Pillow checks
    the actual file contents before the upload receives a server-generated name.
    """
    if upload.size > MAX_IMAGE_BYTES:
        raise ValidationError("Image files must be 5 MB or smaller.")

    try:
        upload.seek(0)
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            image = Image.open(upload)
            image.verify()
            image_format = image.format
            width, height = image.size
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise ValidationError("Upload a valid JPEG, PNG, or WebP image.") from None
    finally:
        upload.seek(0)

    if image_format not in ALLOWED_IMAGE_FORMATS:
        raise ValidationError("Upload a valid JPEG, PNG, or WebP image.")
    if width * height > 25_000_000:
        raise ValidationError("Images must be 25 megapixels or smaller.")

    # Never use a client-supplied path or filename in media storage.
    upload.name = f"{uuid.uuid4().hex}.{ALLOWED_IMAGE_FORMATS[image_format]}"
