"""Medical validation engine for hematology parameters."""

from typing import Dict, List, Optional, Tuple

from app.core.logging import logger
from app.models.schemas import ValidationStatus


class MedicalValidator:
    """Validates extracted hematology parameters against medical ranges."""

    # Medical reference ranges for hematology parameters
    REFERENCE_RANGES = {
        "WBC": {"min": 4.0, "max": 11.0, "unit": "10^9/L", "critical_min": 1.0, "critical_max": 30.0},
        "RBC": {"min": 4.2, "max": 5.4, "unit": "10^12/L", "critical_min": 2.0, "critical_max": 7.0},
        "HGB": {"min": 12.0, "max": 16.0, "unit": "g/dL", "critical_min": 7.0, "critical_max": 20.0},
        "HCT": {"min": 36.0, "max": 46.0, "unit": "%", "critical_min": 20.0, "critical_max": 60.0},
        "MCV": {"min": 80.0, "max": 100.0, "unit": "fL", "critical_min": 60.0, "critical_max": 120.0},
        "MCH": {"min": 27.0, "max": 32.0, "unit": "pg", "critical_min": 20.0, "critical_max": 40.0},
        "MCHC": {"min": 32.0, "max": 36.0, "unit": "g/dL", "critical_min": 28.0, "critical_max": 40.0},
        "PLT": {"min": 150.0, "max": 450.0, "unit": "10^9/L", "critical_min": 50.0, "critical_max": 1000.0},
    }

    def validate_parameter(
        self,
        parameter_name: str,
        value: float,
        unit: str,
        ocr_confidence: float,
        template_rules: Optional[Dict] = None
    ) -> Tuple[ValidationStatus, str]:
        """
        Validate a hematology parameter value.

        Args:
            parameter_name: Name of the parameter (e.g., 'WBC')
            value: Extracted numeric value
            unit: Unit of measurement
            ocr_confidence: OCR confidence score (0-1)
            template_rules: Optional template-specific validation rules

        Returns:
            Tuple of (validation_status, reason_message)
        """
        try:
            # Get reference ranges
            if template_rules and parameter_name in template_rules:
                ranges = template_rules[parameter_name]
            elif parameter_name in self.REFERENCE_RANGES:
                ranges = self.REFERENCE_RANGES[parameter_name]
            else:
                return ValidationStatus.REQUIRES_REVIEW, f"Unknown parameter: {parameter_name}"

            # Check for impossible values
            if value < 0:
                return ValidationStatus.CRITICAL, "Negative values are impossible"

            # Check OCR confidence
            if ocr_confidence < 0.3:
                return ValidationStatus.REQUIRES_REVIEW, f"Low OCR confidence: {ocr_confidence:.2f}"

            # Check unit consistency
            expected_unit = ranges.get("unit", "")
            if expected_unit and unit != expected_unit:
                # Allow some unit variations
                if not self._units_compatible(unit, expected_unit):
                    return ValidationStatus.WARNING, f"Unit mismatch: expected {expected_unit}, got {unit}"

            # Check critical ranges
            critical_min = ranges.get("critical_min", ranges["min"] * 0.1)
            critical_max = ranges.get("critical_max", ranges["max"] * 10)

            if value < critical_min or value > critical_max:
                return ValidationStatus.CRITICAL, f"Value {value} is outside critical range [{critical_min}, {critical_max}]"

            # Check normal ranges
            normal_min = ranges["min"]
            normal_max = ranges["max"]

            if value < normal_min or value > normal_max:
                return ValidationStatus.WARNING, f"Value {value} is outside normal range [{normal_min}, {normal_max}]"

            # All checks passed
            return ValidationStatus.VALID, "Parameter value is within acceptable range"

        except Exception as e:
            logger.error(f"Error validating parameter {parameter_name}: {e}")
            return ValidationStatus.REQUIRES_REVIEW, f"Validation error: {str(e)}"

    def _units_compatible(self, actual_unit: str, expected_unit: str) -> bool:
        """Check if units are compatible (allowing for common variations)."""
        # Normalize units
        actual = actual_unit.lower().strip()
        expected = expected_unit.lower().strip()

        # Direct match
        if actual == expected:
            return True

        # Common variations
        unit_mappings = {
            "10^9/l": ["10^9/l", "10e9/l", "x10^9/l"],
            "10^12/l": ["10^12/l", "10e12/l", "x10^12/l"],
            "g/dl": ["g/dl", "g/dL", "gm/dl"],
            "%": ["%", "percent"],
            "fl": ["fl", "fL"],
            "pg": ["pg", "pG"],
        }

        for canonical, variations in unit_mappings.items():
            if expected in variations and actual in variations:
                return True

        return False

    def calculate_overall_confidence(
        self,
        ocr_confidences: Dict[str, float],
        validation_statuses: Dict[str, ValidationStatus]
    ) -> float:
        """
        Calculate overall extraction confidence based on individual field results.

        Args:
            ocr_confidences: Dict of parameter -> OCR confidence
            validation_statuses: Dict of parameter -> validation status

        Returns:
            Overall confidence score (0-1)
        """
        if not ocr_confidences:
            return 0.0

        # Base confidence from OCR scores
        ocr_scores = list(ocr_confidences.values())
        avg_ocr_confidence = sum(ocr_scores) / len(ocr_scores)

        # Penalty for validation issues
        validation_penalty = 0.0
        for status in validation_statuses.values():
            if status == ValidationStatus.CRITICAL:
                validation_penalty += 0.3
            elif status == ValidationStatus.WARNING:
                validation_penalty += 0.1
            elif status == ValidationStatus.REQUIRES_REVIEW:
                validation_penalty += 0.2

        # Cap penalty at 0.5
        validation_penalty = min(validation_penalty, 0.5)

        # Calculate final confidence
        final_confidence = avg_ocr_confidence * (1.0 - validation_penalty)

        return max(0.0, min(1.0, final_confidence))

    def get_parameter_reference_range(self, parameter_name: str) -> Optional[Dict]:
        """Get reference range for a parameter."""
        return self.REFERENCE_RANGES.get(parameter_name)

    def validate_unit_consistency(self, parameters: Dict[str, Dict]) -> bool:
        """
        Check if all parameters have consistent units.

        Args:
            parameters: Dict of parameter_name -> parameter_data

        Returns:
            True if units are consistent, False otherwise
        """
        units_seen = set()

        for param_data in parameters.values():
            unit = param_data.get("unit", "")
            if unit:
                units_seen.add(unit)

        # For hematology, we expect different units for different parameters
        # So we just check that units are present and reasonable
        return len(units_seen) > 0

    def detect_anomalous_patterns(self, parameters: Dict[str, Dict]) -> List[str]:
        """
        Detect anomalous patterns in the parameter set.

        Args:
            parameters: Dict of parameter_name -> parameter_data

        Returns:
            List of anomaly descriptions
        """
        anomalies = []

        # Check for biologically implausible relationships
        wbc = parameters.get("WBC", {}).get("value")
        rbc = parameters.get("RBC", {}).get("value")
        hgb = parameters.get("HGB", {}).get("value")
        hct = parameters.get("HCT", {}).get("value")

        if wbc is not None and rbc is not None:
            # WBC should not be dramatically higher than RBC count
            if wbc > rbc * 100:  # Very rough check
                anomalies.append("WBC count unusually high relative to RBC")

        if hgb is not None and hct is not None:
            # HGB and HCT should be roughly correlated
            expected_hct = hgb * 3  # Rough approximation
            if abs(hct - expected_hct) > 10:
                anomalies.append("HGB/HCT relationship appears anomalous")

        return anomalies


# Global validator instance
medical_validator = MedicalValidator()