"""Utility functions for the OCR microservice."""

import hashlib
import os
import re
from pathlib import Path
from typing import Dict, Optional, Tuple

import numpy as np


def generate_file_hash(data: bytes) -> str:
    """Generate SHA256 hash for file data."""
    return hashlib.sha256(data).hexdigest()


def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent path traversal and invalid characters."""
    # Remove path separators
    filename = re.sub(r'[\/\\]', '_', filename)

    # Remove other potentially problematic characters
    filename = re.sub(r'[<>:"|?*]', '_', filename)

    # Limit length
    if len(filename) > 255:
        name, ext = os.path.splitext(filename)
        filename = name[:255-len(ext)] + ext

    return filename


def get_image_dimensions(image: np.ndarray) -> Tuple[int, int, int]:
    """Get image dimensions (height, width, channels)."""
    if len(image.shape) == 3:
        height, width, channels = image.shape
    else:
        height, width = image.shape
        channels = 1

    return height, width, channels


def calculate_image_hash(image: np.ndarray) -> str:
    """Calculate hash of image data for duplicate detection."""
    # Convert to bytes
    image_bytes = image.tobytes()
    return hashlib.sha256(image_bytes).hexdigest()


def parse_accession_id(accession_id: str) -> Optional[Dict[str, str]]:
    """
    Parse accession ID to extract components.

    Expected format: PREFIX-YYYY-NNNN or similar
    """
    # Basic validation and parsing
    if not accession_id or not isinstance(accession_id, str):
        return None

    # Remove extra whitespace
    accession_id = accession_id.strip()

    # Basic pattern matching
    pattern = r'^([A-Z]+)-(\d{4})-(\d+)$'
    match = re.match(pattern, accession_id.upper())

    if match:
        prefix, year, number = match.groups()
        return {
            "prefix": prefix,
            "year": year,
            "number": number,
            "full": accession_id
        }

    # Fallback for other formats
    return {
        "full": accession_id,
        "parsed": False
    }


def validate_image_format(image_data: bytes) -> bool:
    """Validate that the data represents a valid image format."""
    try:
        # Check for common image headers
        if len(image_data) < 4:
            return False

        # JPEG
        if image_data[:2] == b'\xff\xd8':
            return True

        # PNG
        if image_data[:8] == b'\x89PNG\r\n\x1a\n':
            return True

        # GIF
        if image_data[:6] in [b'GIF87a', b'GIF89a']:
            return True

        # BMP
        if image_data[:2] == b'BM':
            return True

        # WebP
        if image_data[:4] == b'RIFF' and image_data[8:12] == b'WEBP':
            return True

        return False

    except Exception:
        return False


def format_bytes(size_bytes: int) -> str:
    """Format bytes into human readable format."""
    if size_bytes == 0:
        return "0 B"

    size_names = ["B", "KB", "MB", "GB", "TB"]
    i = 0
    while size_bytes >= 1024 and i < len(size_names) - 1:
        size_bytes /= 1024.0
        i += 1

    return ".1f"


def safe_divide(numerator: float, denominator: float, default: float = 0.0) -> float:
    """Safely divide two numbers, returning default if denominator is zero."""
    try:
        return numerator / denominator if denominator != 0 else default
    except (ZeroDivisionError, TypeError):
        return default


def calculate_confidence_score(ocr_confidence: float, validation_penalty: float = 0.0) -> float:
    """Calculate final confidence score combining OCR and validation factors."""
    base_confidence = ocr_confidence
    final_confidence = base_confidence * (1.0 - validation_penalty)

    # Clamp to valid range
    return max(0.0, min(1.0, final_confidence))


def extract_numbers_from_text(text: str) -> list[float]:
    """Extract all numeric values from text."""
    import re

    # Find all numbers (including decimals)
    number_pattern = r'(\d+\.?\d*)'
    matches = re.findall(number_pattern, text)

    numbers = []
    for match in matches:
        try:
            numbers.append(float(match))
        except ValueError:
            continue

    return numbers


def normalize_parameter_name(name: str) -> str:
    """Normalize parameter names to standard format."""
    if not name:
        return name

    # Convert to uppercase and remove extra spaces
    normalized = name.upper().strip()

    # Common abbreviations
    abbreviations = {
        'HEMOGLOBIN': 'HGB',
        'HEMATOCRIT': 'HCT',
        'WHITE BLOOD CELL': 'WBC',
        'RED BLOOD CELL': 'RBC',
        'PLATELET': 'PLT',
        'MEAN CORPUSCULAR VOLUME': 'MCV',
        'MEAN CORPUSCULAR HEMOGLOBIN': 'MCH',
        'MEAN CORPUSCULAR HEMOGLOBIN CONCENTRATION': 'MCHC',
    }

    return abbreviations.get(normalized, normalized)


def get_file_age_days(filepath: Path) -> float:
    """Get file age in days."""
    import time

    if not filepath.exists():
        return 0

    file_time = filepath.stat().st_mtime
    current_time = time.time()

    return (current_time - file_time) / (24 * 60 * 60)