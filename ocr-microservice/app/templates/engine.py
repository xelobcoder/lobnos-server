"""Template engine for hematology analyzer screen layouts."""

import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.logging import logger


class FieldCoordinates(BaseModel):
    """Coordinates for a field on the analyzer screen."""

    x1: int = Field(..., ge=0, description="Top-left x coordinate")
    y1: int = Field(..., ge=0, description="Top-left y coordinate")
    x2: int = Field(..., ge=0, description="Bottom-right x coordinate")
    y2: int = Field(..., ge=0, description="Bottom-right y coordinate")

    def to_tuple(self) -> Tuple[int, int, int, int]:
        """Convert to tuple format."""
        return (self.x1, self.y1, self.x2, self.y2)

    def get_width(self) -> int:
        """Get field width."""
        return self.x2 - self.x1

    def get_height(self) -> int:
        """Get field height."""
        return self.y2 - self.y1


class AnalyzerTemplate(BaseModel):
    """Template configuration for a specific analyzer device."""

    device_name: str = Field(..., description="Analyzer device name")
    manufacturer: str = Field(..., description="Device manufacturer")
    version: str = Field(..., description="Template version")
    screen_resolution: Tuple[int, int] = Field(..., description="Expected screen resolution (width, height)")
    fields: Dict[str, FieldCoordinates] = Field(..., description="Field coordinates mapping")
    preprocessing_params: Dict = Field(default_factory=dict, description="Preprocessing parameters")
    validation_rules: Dict = Field(default_factory=dict, description="Field validation rules")

    def get_field_coordinates(self, field_name: str) -> Optional[FieldCoordinates]:
        """Get coordinates for a specific field."""
        return self.fields.get(field_name)

    def get_all_field_names(self) -> List[str]:
        """Get list of all field names."""
        return list(self.fields.keys())


class TemplateEngine:
    """Engine for managing and applying analyzer templates."""

    def __init__(self):
        """Initialize the template engine."""
        self.templates: Dict[str, AnalyzerTemplate] = {}
        self._load_templates()

    def _load_templates(self) -> None:
        """Load all available templates from configuration directory."""
        if not settings.template_config_dir.exists():
            logger.warning(f"Template directory {settings.template_config_dir} does not exist")
            return

        template_files = list(settings.template_config_dir.glob("*.json"))
        logger.info(f"Found {len(template_files)} template files")

        for template_file in template_files:
            try:
                with open(template_file, 'r', encoding='utf-8') as f:
                    template_data = json.load(f)

                template = AnalyzerTemplate(**template_data)
                self.templates[template.device_name] = template
                logger.info(f"Loaded template for {template.device_name}")

            except Exception as e:
                logger.error(f"Failed to load template {template_file}: {e}")

    def get_template(self, device_name: str) -> Optional[AnalyzerTemplate]:
        """Get template for a specific device."""
        return self.templates.get(device_name)

    def get_supported_devices(self) -> List[Dict]:
        """Get list of supported devices."""
        return [
            {
                "name": template.device_name,
                "manufacturer": template.manufacturer,
                "parameters": template.get_all_field_names(),
                "template_version": template.version,
            }
            for template in self.templates.values()
        ]

    def detect_device(self, image: np.ndarray) -> Optional[str]:
        """
        Attempt to detect the analyzer device from the image.
        This is a basic implementation - in production, you might use
        more sophisticated template matching or ML-based detection.
        """
        # For now, return the first available template
        # In production, implement actual device detection logic
        if self.templates:
            return list(self.templates.keys())[0]

        return None

    def extract_field_image(self, image: np.ndarray, coordinates: FieldCoordinates) -> np.ndarray:
        """Extract a field image from the main image using coordinates."""
        x1, y1, x2, y2 = coordinates.to_tuple()

        # Ensure coordinates are within image bounds
        height, width = image.shape[:2]
        x1 = max(0, min(x1, width))
        x2 = max(0, min(x2, width))
        y1 = max(0, min(y1, height))
        y2 = max(0, min(y2, height))

        # Extract the field
        field_image = image[y1:y2, x1:x2]

        return field_image

    def create_template_from_image(self, image_path: Path, device_name: str) -> Dict:
        """
        Helper method to create a template by manually annotating an image.
        This would typically be done through a web interface or annotation tool.
        """
        # This is a placeholder for template creation functionality
        # In production, you'd implement an annotation interface
        logger.info(f"Template creation for {device_name} from {image_path}")

        # Return a basic template structure
        return {
            "device_name": device_name,
            "manufacturer": "Unknown",
            "version": "1.0.0",
            "screen_resolution": [800, 600],
            "fields": {},
            "preprocessing_params": {},
            "validation_rules": {},
        }


# Global template engine instance
template_engine = TemplateEngine()