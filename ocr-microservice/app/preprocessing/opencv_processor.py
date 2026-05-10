"""OpenCV-based image preprocessing for OCR optimization."""

import cv2
import numpy as np
from pathlib import Path
from typing import Dict, Optional, Tuple

from app.core.config import settings
from app.core.logging import logger


class ImagePreprocessor:
    """Handles image preprocessing for optimal OCR results."""

    def __init__(self):
        """Initialize the image preprocessor."""
        self.max_width = settings.image_max_width
        self.max_height = settings.image_max_height
        self.quality = settings.image_quality

    def preprocess_image(self, image: np.ndarray, params: Optional[Dict] = None) -> np.ndarray:
        """
        Apply comprehensive preprocessing to optimize image for OCR.

        Args:
            image: Input image as numpy array
            params: Optional preprocessing parameters

        Returns:
            Preprocessed image
        """
        if params is None:
            params = {}

        try:
            # Step 1: Resize if too large
            image = self._resize_image(image)

            # Step 2: Convert to grayscale if needed
            if len(image.shape) == 3:
                image = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

            # Step 3: Noise reduction
            image = self._reduce_noise(image, params.get('denoise_strength', 5))

            # Step 4: Contrast enhancement
            image = self._enhance_contrast(image, params)

            # Step 5: Sharpening
            image = self._sharpen_image(image, params)

            # Step 6: Adaptive thresholding
            image = self._adaptive_threshold(image)

            # Step 7: Morphological operations
            image = self._morphological_operations(image)

            logger.debug("Image preprocessing completed successfully")
            return image

        except Exception as e:
            logger.error(f"Error during image preprocessing: {e}")
            # Return original image if preprocessing fails
            return image

    def _resize_image(self, image: np.ndarray) -> np.ndarray:
        """Resize image if it exceeds maximum dimensions."""
        height, width = image.shape[:2]

        if width > self.max_width or height > self.max_height:
            # Calculate scaling factor
            scale_w = self.max_width / width
            scale_h = self.max_height / height
            scale = min(scale_w, scale_h)

            new_width = int(width * scale)
            new_height = int(height * scale)

            # Resize image
            image = cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_AREA)

            logger.debug(f"Image resized from {width}x{height} to {new_width}x{new_height}")

        return image

    def _reduce_noise(self, image: np.ndarray, strength: int = 5) -> np.ndarray:
        """Apply noise reduction using bilateral filter."""
        if strength > 0:
            image = cv2.bilateralFilter(image, strength, 75, 75)
            logger.debug(f"Applied noise reduction with strength {strength}")
        return image

    def _enhance_contrast(self, image: np.ndarray, params: Dict) -> np.ndarray:
        """Enhance image contrast."""
        alpha = params.get('contrast_alpha', 1.2)  # Contrast control
        beta = params.get('contrast_beta', 10)     # Brightness control

        image = cv2.convertScaleAbs(image, alpha=alpha, beta=beta)
        logger.debug(f"Applied contrast enhancement: alpha={alpha}, beta={beta}")
        return image

    def _sharpen_image(self, image: np.ndarray, params: Dict) -> np.ndarray:
        """Apply sharpening filter to improve text edges."""
        kernel_data = params.get('sharpen_kernel', [
            [0, -1, 0],
            [-1, 5, -1],
            [0, -1, 0]
        ])

        kernel = np.array(kernel_data, dtype=np.float32)
        image = cv2.filter2D(image, -1, kernel)
        logger.debug("Applied sharpening filter")
        return image

    def _adaptive_threshold(self, image: np.ndarray) -> np.ndarray:
        """Apply adaptive thresholding for better text segmentation."""
        # Adaptive thresholding works better than global thresholding for varying lighting
        image = cv2.adaptiveThreshold(
            image, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
        )
        logger.debug("Applied adaptive thresholding")
        return image

    def _morphological_operations(self, image: np.ndarray) -> np.ndarray:
        """Apply morphological operations to clean up the image."""
        # Remove small noise
        kernel = np.ones((2, 2), np.uint8)
        image = cv2.morphologyEx(image, cv2.MORPH_OPEN, kernel)

        # Close small gaps
        kernel = np.ones((1, 1), np.uint8)
        image = cv2.morphologyEx(image, cv2.MORPH_CLOSE, kernel)

        logger.debug("Applied morphological operations")
        return image

    def correct_perspective(self, image: np.ndarray) -> np.ndarray:
        """Correct perspective distortion if detected."""
        try:
            # This is a simplified perspective correction
            # In production, you'd implement edge detection and perspective transformation
            height, width = image.shape[:2]

            # For now, just return the original image
            # Perspective correction would require detecting the screen boundaries
            logger.debug("Perspective correction skipped (not implemented)")
            return image

        except Exception as e:
            logger.error(f"Error during perspective correction: {e}")
            return image

    def reduce_glare(self, image: np.ndarray) -> np.ndarray:
        """Reduce glare and reflections from the image."""
        try:
            # Convert to LAB color space for better glare handling
            if len(image.shape) == 3:
                lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
                l, a, b = cv2.split(lab)

                # Apply CLAHE to L channel
                clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
                l = clahe.apply(l)

                # Merge channels
                lab = cv2.merge([l, a, b])
                image = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

            logger.debug("Applied glare reduction")
            return image

        except Exception as e:
            logger.error(f"Error during glare reduction: {e}")
            return image

    def save_debug_image(self, image: np.ndarray, filename: str, directory: Optional[Path] = None) -> None:
        """Save image for debugging purposes."""
        if directory is None:
            directory = settings.debug_dir

        directory.mkdir(parents=True, exist_ok=True)
        filepath = directory / filename

        try:
            cv2.imwrite(str(filepath), image)
            logger.debug(f"Saved debug image: {filepath}")
        except Exception as e:
            logger.error(f"Failed to save debug image {filepath}: {e}")

    def get_image_info(self, image: np.ndarray) -> Dict:
        """Get basic information about the image."""
        height, width = image.shape[:2]
        channels = 1 if len(image.shape) == 2 else image.shape[2]

        return {
            "width": width,
            "height": height,
            "channels": channels,
            "dtype": str(image.dtype),
            "size_bytes": image.nbytes,
        }


# Global preprocessor instance
image_preprocessor = ImagePreprocessor()