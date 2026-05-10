"""Pydantic models for the OCR microservice API."""

from enum import Enum
from pathlib import Path
from typing import Dict, Optional

from pydantic import BaseModel, Field, validator


class ValidationStatus(str, Enum):
    """Validation status for extracted fields."""

    VALID = "VALID"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"
    REQUIRES_REVIEW = "REQUIRES_REVIEW"


class ExtractedField(BaseModel):
    """Model for an extracted laboratory parameter."""

    value: float = Field(..., description="The extracted numeric value")
    unit: str = Field(..., description="The unit of measurement")
    confidence: float = Field(..., ge=0.0, le=1.0, description="OCR confidence score")
    status: ValidationStatus = Field(..., description="Validation status")
    raw_text: Optional[str] = Field(None, description="Raw OCR text before processing")
    normalized_field: Optional[str] = Field(None, description="Normalized field name")


class ExtractionResult(BaseModel):
    """Model for the complete extraction result."""

    success: bool = Field(..., description="Whether extraction was successful")
    accession_id: str = Field(..., description="Laboratory accession identifier")
    device: str = Field(..., description="Detected analyzer device name")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Overall extraction confidence")
    output_file: Path = Field(..., description="Path to saved JSON result file")
    results: Dict[str, ExtractedField] = Field(..., description="Extracted laboratory parameters")
    processing_time: Optional[float] = Field(None, description="Total processing time in seconds")
    error_message: Optional[str] = Field(None, description="Error message if extraction failed")


class ExtractionRequest(BaseModel):
    """Model for extraction request parameters."""

    accession_id: str = Field(..., min_length=1, max_length=50, description="Laboratory accession identifier")

    @validator('accession_id')
    def validate_accession_id(cls, v):
        """Validate accession ID format."""
        if not v.replace('-', '').replace('_', '').isalnum():
            raise ValueError('Accession ID must contain only alphanumeric characters, hyphens, and underscores')
        return v


class SupportedDevice(BaseModel):
    """Model for supported analyzer device information."""

    name: str = Field(..., description="Device name")
    manufacturer: str = Field(..., description="Device manufacturer")
    parameters: list[str] = Field(..., description="Supported parameters")
    template_version: str = Field(..., description="Template configuration version")


class HealthStatus(BaseModel):
    """Model for service health status."""

    status: str = Field(..., description="Service status")
    version: str = Field(..., description="Service version")
    uptime: float = Field(..., description="Service uptime in seconds")
    memory_usage: Dict[str, float] = Field(..., description="Memory usage statistics")
    disk_usage: Dict[str, float] = Field(..., description="Disk usage statistics")


class ErrorResponse(BaseModel):
    """Model for error responses."""

    success: bool = Field(default=False, description="Always false for errors")
    error: str = Field(..., description="Error type or code")
    message: str = Field(..., description="Human-readable error message")
    details: Optional[Dict] = Field(None, description="Additional error details")