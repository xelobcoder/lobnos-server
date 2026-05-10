"""Main OCR extraction service that orchestrates all components."""

import asyncio
import time
from pathlib import Path
from typing import Dict, Optional

import cv2
import numpy as np

from app.core.config import settings
from app.core.logging import logger
from app.models.schemas import ExtractionResult, ExtractedField, ValidationStatus
from app.ocr.engine import ocr_engine
from app.preprocessing.opencv_processor import image_preprocessor
from app.storage.manager import storage_manager
from app.templates.engine import template_engine
from app.validators.medical import medical_validator


class OCRExtractionService:
    """Main service for OCR-based laboratory result extraction."""

    def __init__(self):
        """Initialize the extraction service."""
        self.max_concurrent_requests = settings.max_concurrent_requests
        self._semaphore = asyncio.Semaphore(self.max_concurrent_requests)

    async def extract_results(
        self,
        image_data: bytes,
        accession_id: str,
        original_filename: str
    ) -> ExtractionResult:
        """
        Extract laboratory results from analyzer image.

        Args:
            image_data: Raw image bytes
            accession_id: Laboratory accession identifier
            original_filename: Original uploaded filename

        Returns:
            ExtractionResult with extracted parameters
        """
        start_time = time.time()

        async with self._semaphore:
            try:
                logger.info(f"Starting extraction for accession {accession_id}")

                # Step 1: Save original image
                original_path = await storage_manager.save_uploaded_image(
                    image_data, accession_id, original_filename
                )

                # Step 2: Load and preprocess image
                image = cv2.imdecode(np.frombuffer(image_data, np.uint8), cv2.IMREAD_COLOR)
                if image is None:
                    raise ValueError("Failed to decode image")

                # Step 3: Detect device template
                device_name = template_engine.detect_device(image)
                if not device_name:
                    logger.warning(f"No device template detected for {accession_id}")
                    device_name = "Unknown Analyzer"

                template = template_engine.get_template(device_name)
                preprocessing_params = template.preprocessing_params if template else {}

                # Step 4: Preprocess image
                processed_image = image_preprocessor.preprocess_image(image, preprocessing_params)

                # Save processed image for debugging
                _, processed_buffer = cv2.imencode('.png', processed_image)
                await storage_manager.save_processed_image(
                    processed_buffer.tobytes(), accession_id, "processed"
                )

                # Step 5: Extract parameters using template
                extracted_fields = await self._extract_parameters_from_template(
                    processed_image, template, accession_id
                )

                # Step 6: Calculate overall confidence
                ocr_confidences = {k: v.confidence for k, v in extracted_fields.items()}
                validation_statuses = {k: v.status for k, v in extracted_fields.items()}
                overall_confidence = medical_validator.calculate_overall_confidence(
                    ocr_confidences, validation_statuses
                )

                # Step 7: Create result object
                result_data = {
                    "success": True,
                    "accession_id": accession_id,
                    "device": device_name,
                    "confidence_score": overall_confidence,
                    "results": extracted_fields,
                    "processing_time": time.time() - start_time,
                }

                # Step 8: Save result to file
                result_file_path = await storage_manager.save_extraction_result(
                    result_data, accession_id
                )

                result_data["output_file"] = result_file_path

                logger.info(f"Extraction completed for {accession_id} in {result_data['processing_time']:.2f}s")

                return ExtractionResult(**result_data)

            except Exception as e:
                logger.error(f"Extraction failed for {accession_id}: {e}")

                # Return error result
                return ExtractionResult(
                    success=False,
                    accession_id=accession_id,
                    device="Unknown",
                    confidence_score=0.0,
                    results={},
                    processing_time=time.time() - start_time,
                    error_message=str(e)
                )

    async def _extract_parameters_from_template(
        self,
        image: np.ndarray,
        template: Optional[object],
        accession_id: str
    ) -> Dict[str, ExtractedField]:
        """
        Extract parameters using template coordinates.

        Args:
            image: Preprocessed image
            template: Device template
            accession_id: For logging

        Returns:
            Dictionary of extracted fields
        """
        extracted_fields = {}

        if not template:
            logger.warning(f"No template available for {accession_id}")
            return extracted_fields

        # Process each field in the template
        field_images = {}

        # Extract field images
        for field_name, coordinates in template.fields.items():
            try:
                field_image = template_engine.extract_field_image(image, coordinates)
                field_images[field_name] = field_image
            except Exception as e:
                logger.error(f"Failed to extract field image for {field_name}: {e}")

        # Process all field images in parallel
        field_results = await ocr_engine.process_field_batch(field_images)

        # Process and validate each field
        for field_name, (raw_text, ocr_confidence) in field_results.items():
            try:
                # Normalize the extracted text
                normalized_text = ocr_engine.normalize_extracted_text(raw_text)

                # Extract value and unit
                value, unit = ocr_engine.extract_parameter_value(normalized_text)

                if value is not None:
                    # Validate the parameter
                    validation_rules = template.validation_rules if template else None
                    status, reason = medical_validator.validate_parameter(
                        field_name, value, unit, ocr_confidence, validation_rules
                    )

                    extracted_field = ExtractedField(
                        value=value,
                        unit=unit,
                        confidence=ocr_confidence,
                        status=status,
                        raw_text=raw_text,
                        normalized_field=field_name,
                    )

                    extracted_fields[field_name] = extracted_field

                    logger.debug(f"Extracted {field_name}: {value} {unit} (confidence: {ocr_confidence:.2f}, status: {status})")
                else:
                    logger.warning(f"Could not extract value from {field_name} text: '{raw_text}'")

            except Exception as e:
                logger.error(f"Error processing field {field_name}: {e}")

        return extracted_fields

    async def get_supported_devices(self) -> list:
        """Get list of supported analyzer devices."""
        return template_engine.get_supported_devices()

    async def get_extraction_result(self, accession_id: str) -> Optional[Dict]:
        """Retrieve a previously saved extraction result."""
        return await storage_manager.load_result_file(accession_id)

    async def cleanup_old_files(self, days_old: int = 30) -> int:
        """Clean up old stored files."""
        return await storage_manager.cleanup_old_files(days_old)

    def get_service_stats(self) -> Dict:
        """Get service statistics."""
        return {
            "storage_stats": storage_manager.get_storage_stats(),
            "supported_devices": len(template_engine.templates),
            "active_requests": self.max_concurrent_requests - self._semaphore._value,
        }


# Global extraction service instance
extraction_service = OCRExtractionService()