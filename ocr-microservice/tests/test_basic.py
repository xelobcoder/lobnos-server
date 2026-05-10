"""Unit tests for the OCR microservice."""

import pytest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.schemas import ValidationStatus
from app.validators.medical import medical_validator
from app.utils.helpers import parse_accession_id, validate_image_format


class TestMedicalValidator:
    """Test cases for medical parameter validation."""

    def test_validate_normal_wbc(self):
        """Test validation of normal WBC value."""
        status, message = medical_validator.validate_parameter(
            "WBC", 6.5, "10^9/L", 0.9
        )

        assert status == ValidationStatus.VALID
        assert "within acceptable range" in message

    def test_validate_high_wbc(self):
        """Test validation of high WBC value."""
        status, message = medical_validator.validate_parameter(
            "WBC", 15.0, "10^9/L", 0.8
        )

        assert status == ValidationStatus.WARNING
        assert "outside normal range" in message

    def test_validate_critical_wbc(self):
        """Test validation of critically high WBC value."""
        status, message = medical_validator.validate_parameter(
            "WBC", 50.0, "10^9/L", 0.7
        )

        assert status == ValidationStatus.CRITICAL
        assert "outside critical range" in message

    def test_validate_negative_value(self):
        """Test validation of negative value."""
        status, message = medical_validator.validate_parameter(
            "WBC", -5.0, "10^9/L", 0.9
        )

        assert status == ValidationStatus.CRITICAL
        assert "Negative values are impossible" in message

    def test_validate_low_confidence(self):
        """Test validation with low OCR confidence."""
        status, message = medical_validator.validate_parameter(
            "WBC", 6.5, "10^9/L", 0.2
        )

        assert status == ValidationStatus.REQUIRES_REVIEW
        assert "Low OCR confidence" in message

    def test_calculate_overall_confidence(self):
        """Test overall confidence calculation."""
        ocr_confidences = {"WBC": 0.9, "RBC": 0.8, "HGB": 0.7}
        validation_statuses = {
            "WBC": ValidationStatus.VALID,
            "RBC": ValidationStatus.WARNING,
            "HGB": ValidationStatus.VALID
        }

        confidence = medical_validator.calculate_overall_confidence(
            ocr_confidences, validation_statuses
        )

        # Should be average OCR confidence with penalty for warning
        expected = (0.9 + 0.8 + 0.7) / 3 * (1.0 - 0.1)  # 0.8 * 0.9 = 0.72
        assert abs(confidence - expected) < 0.01


class TestUtilityFunctions:
    """Test cases for utility functions."""

    def test_parse_accession_id_valid(self):
        """Test parsing valid accession ID."""
        result = parse_accession_id("ACC-2026-0001")

        assert result is not None
        assert result["prefix"] == "ACC"
        assert result["year"] == "2026"
        assert result["number"] == "0001"

    def test_parse_accession_id_invalid(self):
        """Test parsing invalid accession ID."""
        result = parse_accession_id("INVALID")

        assert result is not None
        assert result["full"] == "INVALID"
        assert result.get("parsed") is False

    def test_validate_image_format_jpeg(self):
        """Test JPEG image format validation."""
        jpeg_header = b'\xff\xd8\xff\xe0'
        assert validate_image_format(jpeg_header) is True

    def test_validate_image_format_png(self):
        """Test PNG image format validation."""
        png_header = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR'
        assert validate_image_format(png_header) is True

    def test_validate_image_format_invalid(self):
        """Test invalid image format validation."""
        invalid_data = b'INVALID'
        assert validate_image_format(invalid_data) is False

    def test_validate_image_format_empty(self):
        """Test empty data validation."""
        empty_data = b''
        assert validate_image_format(empty_data) is False


class TestIntegration:
    """Integration tests for the service."""

    @pytest.mark.asyncio
    async def test_extraction_service_initialization(self):
        """Test that extraction service initializes properly."""
        from app.services.extraction import extraction_service

        # Service should be initialized
        assert extraction_service is not None
        assert hasattr(extraction_service, 'extract_results')

    def test_template_engine_loading(self):
        """Test that template engine loads templates."""
        from app.templates.engine import template_engine

        # Should have loaded templates
        assert template_engine is not None
        assert hasattr(template_engine, 'templates')

    def test_ocr_engine_initialization(self):
        """Test OCR engine initialization."""
        from app.ocr.engine import ocr_engine

        # OCR engine should be initialized
        assert ocr_engine is not None

    def test_storage_manager_initialization(self):
        """Test storage manager initialization."""
        from app.storage.manager import storage_manager

        # Storage manager should be initialized
        assert storage_manager is not None
        assert hasattr(storage_manager, 'upload_dir')


# Fixtures
@pytest.fixture
def sample_image_data():
    """Sample image data for testing."""
    # Create a minimal valid PNG header for testing
    return b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xdb\x00\x00\x00\x00IEND\xaeB`\x82'


@pytest.fixture
def sample_accession_id():
    """Sample accession ID for testing."""
    return "TEST-2026-0001"