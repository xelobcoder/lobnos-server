"""OCR engine integrating PaddleOCR and Tesseract with fallback logic."""

import asyncio
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np

from app.core.config import settings
from app.core.logging import logger

# Try to import OCR libraries, with fallbacks for testing
try:
    from paddleocr import PaddleOCR
    PADDLE_AVAILABLE = True
except ImportError:
    PADDLE_AVAILABLE = False
    logger.warning("PaddleOCR not available, using Tesseract only")

try:
    import pytesseract
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False
    logger.warning("Tesseract not available")


class OCREngine:
    """OCR engine with PaddleOCR primary and Tesseract fallback."""

    def __init__(self):
        """Initialize OCR engines."""
        self.paddle_ocr = None
        self.tesseract_config = '--oem 3 --psm 6 -c tessedit_char_whitelist=0123456789.-x^/gLdLfm%'
        self._initialize_engines()

    def _initialize_engines(self) -> None:
        """Initialize OCR engines."""
        if PADDLE_AVAILABLE:
            try:
                # Initialize PaddleOCR with minimal parameters
                logger.info("Initializing PaddleOCR...")
                self.paddle_ocr = PaddleOCR(lang='en')
                logger.info("PaddleOCR initialized successfully")

            except Exception as e:
                logger.error(f"Failed to initialize PaddleOCR: {e}")
                self.paddle_ocr = None
        else:
            logger.warning("PaddleOCR not available for this platform")
            self.paddle_ocr = None

        # Test Tesseract availability
        if TESSERACT_AVAILABLE:
            try:
                version = pytesseract.get_tesseract_version()
                logger.info(f"Tesseract version: {version}")
            except Exception as e:
                logger.error(f"Tesseract not available: {e}")
        else:
            logger.warning("Tesseract not available")

    async def extract_text(self, image: np.ndarray, timeout: Optional[int] = None) -> Tuple[str, float]:
        """
        Extract text from image using primary OCR with fallback.

        Args:
            image: Preprocessed image
            timeout: Timeout in seconds

        Returns:
            Tuple of (extracted_text, confidence_score)
        """
        if timeout is None:
            timeout = settings.ocr_timeout

        try:
            # Try PaddleOCR first
            if self.paddle_ocr:
                text, confidence = await self._extract_with_paddle(image, timeout)
                if confidence >= settings.paddle_confidence_threshold:
                    logger.debug(f"PaddleOCR successful: confidence {confidence}")
                    return text, confidence

                logger.debug(f"PaddleOCR confidence {confidence} below threshold, trying Tesseract")

            # Fallback to Tesseract
            text, confidence = await self._extract_with_tesseract(image, timeout)
            logger.debug(f"Tesseract result: confidence {confidence}")
            return text, confidence

        except Exception as e:
            logger.error(f"OCR extraction failed: {e}")
            return "", 0.0

    async def _extract_with_paddle(self, image: np.ndarray, timeout: int) -> Tuple[str, float]:
        """Extract text using PaddleOCR."""
        try:
            # Run OCR in thread pool to avoid blocking
            result = await asyncio.get_event_loop().run_in_executor(
                None,
                self._paddle_ocr_sync,
                image,
                timeout
            )

            if not result:
                return "", 0.0

            # PaddleOCR returns list of [text, confidence] pairs
            text = ""
            total_confidence = 0.0
            count = 0

            for line in result:
                if len(line) >= 2:
                    line_text = line[0]
                    line_confidence = line[1]

                    text += line_text + " "
                    total_confidence += line_confidence
                    count += 1

            if count > 0:
                avg_confidence = total_confidence / count
            else:
                avg_confidence = 0.0

            return text.strip(), avg_confidence

        except Exception as e:
            logger.error(f"PaddleOCR extraction failed: {e}")
            return "", 0.0

    def _paddle_ocr_sync(self, image: np.ndarray, timeout: int) -> List:
        """Synchronous PaddleOCR execution."""
        try:
            result = self.paddle_ocr.ocr(image, cls=True)
            return result[0] if result and len(result) > 0 else []
        except Exception as e:
            logger.error(f"PaddleOCR sync execution failed: {e}")
            return []

    async def _extract_with_tesseract(self, image: np.ndarray, timeout: int) -> Tuple[str, float]:
        """Extract text using Tesseract OCR."""
        try:
            # Run Tesseract in thread pool
            result = await asyncio.get_event_loop().run_in_executor(
                None,
                self._tesseract_ocr_sync,
                image,
                timeout
            )

            text = result.get('text', '').strip()
            confidence = result.get('confidence', 0.0)

            return text, confidence

        except Exception as e:
            logger.error(f"Tesseract extraction failed: {e}")
            return "", 0.0

    def _tesseract_ocr_sync(self, image: np.ndarray, timeout: int) -> Dict:
        """Synchronous Tesseract execution."""
        try:
            # Get detailed OCR data
            data = pytesseract.image_to_data(
                image,
                config=self.tesseract_config,
                output_type=pytesseract.Output.DICT,
                timeout=timeout
            )

            # Extract text and calculate average confidence
            texts = data.get('text', [])
            confidences = data.get('conf', [])

            # Filter out empty texts and low confidence
            valid_texts = []
            valid_confidences = []

            for text, conf in zip(texts, confidences):
                text = text.strip()
                if text and conf > 10:  # Filter very low confidence
                    valid_texts.append(text)
                    valid_confidences.append(conf / 100.0)  # Convert to 0-1 scale

            if not valid_texts:
                return {'text': '', 'confidence': 0.0}

            # Combine texts and calculate average confidence
            combined_text = ' '.join(valid_texts)
            avg_confidence = sum(valid_confidences) / len(valid_confidences)

            return {
                'text': combined_text,
                'confidence': avg_confidence
            }

        except Exception as e:
            logger.error(f"Tesseract sync execution failed: {e}")
            return {'text': '', 'confidence': 0.0}

    def normalize_extracted_text(self, text: str) -> str:
        """Normalize common OCR errors in medical parameters."""
        if not text:
            return text

        # Common OCR corrections for hematology parameters
        corrections = {
            'H6B': 'HGB',
            'HGB': 'HGB',
            'PLI': 'PLT',
            'PLT': 'PLT',
            'WBC': 'WBC',
            'RBC': 'RBC',
            'HCT': 'HCT',
            'MCV': 'MCV',
            'MCH': 'MCH',
            'MCHC': 'MCHC',
            'l0^9/L': '10^9/L',
            '10^9/L': '10^9/L',
            '10^12/L': '10^12/L',
            'g/dL': 'g/dL',
            'fL': 'fL',
            'pg': 'pg',
            '%': '%',
        }

        # Apply corrections
        normalized = text.upper()

        # Fix common OCR errors
        normalized = normalized.replace('O', '0')
        normalized = normalized.replace('I', '1')
        normalized = normalized.replace('L', '1')
        normalized = normalized.replace('Z', '2')
        normalized = normalized.replace('S', '5')
        normalized = normalized.replace('B', '8')

        # Apply known corrections
        for wrong, correct in corrections.items():
            normalized = normalized.replace(wrong, correct)

        return normalized

    def extract_parameter_value(self, text: str) -> Tuple[Optional[float], Optional[str]]:
        """
        Extract numeric value and unit from OCR text.

        Args:
            text: Raw OCR text

        Returns:
            Tuple of (value, unit) or (None, None) if not found
        """
        import re

        # Pattern to match numbers with optional decimals and units
        pattern = r'(\d+\.?\d*)\s*([a-zA-Z/%^0-9]+)?'
        match = re.search(pattern, text)

        if match:
            value_str = match.group(1)
            unit = match.group(2) or ""

            try:
                value = float(value_str)
                return value, unit.strip()
            except ValueError:
                pass

        return None, None

    async def process_field_batch(self, field_images: Dict[str, np.ndarray]) -> Dict[str, Tuple[str, float]]:
        """
        Process multiple field images in parallel.

        Args:
            field_images: Dict of field_name -> image

        Returns:
            Dict of field_name -> (text, confidence)
        """
        tasks = []
        for field_name, image in field_images.items():
            task = self.extract_text(image)
            tasks.append((field_name, task))

        results = {}
        for field_name, task in tasks:
            try:
                text, confidence = await task
                results[field_name] = (text, confidence)
            except Exception as e:
                logger.error(f"Failed to process field {field_name}: {e}")
                results[field_name] = ("", 0.0)

        return results


# Global OCR engine instance
ocr_engine = OCREngine()