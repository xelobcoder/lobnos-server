"""Core configuration and settings for the OCR microservice."""

import os
from pathlib import Path
from typing import List, Optional

from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    # Application Settings
    environment: str = Field(default="development", env="ENVIRONMENT")
    log_level: str = Field(default="INFO", env="LOG_LEVEL")
    debug: bool = Field(default=False, env="DEBUG")

    # Server Settings
    host: str = Field(default="0.0.0.0", env="HOST")
    port: int = Field(default=8000, env="PORT")
    workers: int = Field(default=2, env="WORKERS")

    # File Storage Settings
    upload_dir: Path = Field(default=Path("./uploads"), env="UPLOAD_DIR")
    processed_dir: Path = Field(default=Path("./processed"), env="PROCESSED_DIR")
    results_dir: Path = Field(default=Path("./results"), env="RESULTS_DIR")
    debug_dir: Path = Field(default=Path("./debug"), env="DEBUG_DIR")
    logs_dir: Path = Field(default=Path("./logs"), env="LOGS_DIR")

    # File Size Limits
    max_file_size: int = Field(default=10 * 1024 * 1024, env="MAX_FILE_SIZE")  # 10MB

    # OCR Settings
    ocr_timeout: int = Field(default=30, env="OCR_TIMEOUT")
    paddle_confidence_threshold: float = Field(default=0.7, env="PADDLE_CONFIDENCE_THRESHOLD")
    tesseract_confidence_threshold: float = Field(default=0.6, env="TESSERACT_CONFIDENCE_THRESHOLD")

    # Image Processing Settings
    image_max_width: int = Field(default=2000, env="IMAGE_MAX_WIDTH")
    image_max_height: int = Field(default=2000, env="IMAGE_MAX_HEIGHT")
    image_quality: int = Field(default=95, env="IMAGE_QUALITY")

    # Template Settings
    template_config_dir: Path = Field(default=Path("./config/templates"), env="TEMPLATE_CONFIG_DIR")

    # Validation Settings
    validation_strict_mode: bool = Field(default=True, env="VALIDATION_STRICT_MODE")
    confidence_warning_threshold: float = Field(default=0.8, env="CONFIDENCE_WARNING_THRESHOLD")
    confidence_critical_threshold: float = Field(default=0.6, env="CONFIDENCE_CRITICAL_THRESHOLD")

    # Performance Settings
    max_concurrent_requests: int = Field(default=5, env="MAX_CONCURRENT_REQUESTS")
    request_timeout: int = Field(default=60, env="REQUEST_TIMEOUT")

    # Security Settings
    allowed_origins: List[str] = Field(default=["http://localhost:3000", "http://localhost:5000"], env="ALLOWED_ORIGINS")
    cors_allow_credentials: bool = Field(default=True, env="CORS_ALLOW_CREDENTIALS")

    class Config:
        """Pydantic configuration."""
        env_file = ".env"
        case_sensitive = False

    def create_directories(self) -> None:
        """Create necessary directories if they don't exist."""
        directories = [
            self.upload_dir,
            self.processed_dir,
            self.results_dir,
            self.debug_dir,
            self.logs_dir,
            self.template_config_dir,
        ]

        for directory in directories:
            directory.mkdir(parents=True, exist_ok=True)


# Global settings instance
settings = Settings()
settings.create_directories()