"""FastAPI application for the OCR microservice."""

import time
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.logging import logger
from app.models.schemas import ErrorResponse, ExtractionResult, HealthStatus, SupportedDevice
from app.services.extraction import extraction_service


# Create FastAPI application
app = FastAPI(
    title="OCR Microservice",
    description="Laboratory Information System OCR Microservice for hematology analyzer result extraction",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Application startup event."""
    logger.info("OCR Microservice starting up")
    # Initialize any startup tasks here


@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown event."""
    logger.info("OCR Microservice shutting down")


@app.get("/health", response_model=HealthStatus)
async def health_check():
    """Health check endpoint."""
    import psutil
    import os

    try:
        # Get system information
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')

        # Get service stats
        service_stats = extraction_service.get_service_stats()

        health_data = {
            "status": "healthy",
            "version": "1.0.0",
            "uptime": time.time() - psutil.boot_time(),
            "memory_usage": {
                "total": memory.total,
                "available": memory.available,
                "percent": memory.percent,
                "used": memory.used,
            },
            "disk_usage": {
                "total": disk.total,
                "free": disk.free,
                "used": disk.used,
                "percent": disk.percent,
            },
        }

        return HealthStatus(**health_data)

    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Health check failed"
        )


@app.get("/supported-devices")
async def get_supported_devices():
    """Get list of supported analyzer devices."""
    try:
        devices = await extraction_service.get_supported_devices()
        return {"devices": devices, "count": len(devices)}
    except Exception as e:
        logger.error(f"Failed to get supported devices: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve supported devices"
        )


@app.post("/extract-results", response_model=ExtractionResult)
async def extract_results(
    accession_id: str,
    image: UploadFile = File(...),
):
    """
    Extract laboratory results from analyzer image.

    - **accession_id**: Laboratory accession identifier
    - **image**: Analyzer screen image file
    """
    start_time = time.time()

    try:
        # Validate input
        if not accession_id or not accession_id.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Accession ID is required"
            )

        # Validate file type
        if not image.content_type.startswith('image/'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file must be an image"
            )

        # Check file size
        file_size = 0
        image_data = await image.read()
        file_size = len(image_data)

        if file_size > settings.max_file_size:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size {file_size} exceeds maximum allowed size {settings.max_file_size}"
            )

        if file_size == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty"
            )

        logger.info(f"Processing extraction request for accession {accession_id}, file size: {file_size} bytes")

        # Process the extraction
        result = await extraction_service.extract_results(
            image_data=image_data,
            accession_id=accession_id.strip(),
            original_filename=image.filename or "unknown.jpg"
        )

        processing_time = time.time() - start_time
        logger.info(f"Extraction completed for {accession_id} in {processing_time:.2f}s")

        return result

    except HTTPException:
        raise
    except Exception as e:
        processing_time = time.time() - start_time
        logger.error(f"Extraction failed for {accession_id} after {processing_time:.2f}s: {e}")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Extraction failed: {str(e)}"
        )


@app.get("/results/{accession_id}")
async def get_extraction_result(accession_id: str):
    """Retrieve a previously saved extraction result."""
    try:
        result = await extraction_service.get_extraction_result(accession_id)

        if result is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No extraction result found for accession ID: {accession_id}"
            )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve result for {accession_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve extraction result"
        )


@app.post("/cleanup")
async def cleanup_old_files(days_old: int = 30):
    """Clean up old stored files (admin endpoint)."""
    try:
        if days_old < 1 or days_old > 365:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="days_old must be between 1 and 365"
            )

        removed_count = await extraction_service.cleanup_old_files(days_old)

        return {
            "message": f"Cleaned up {removed_count} files older than {days_old} days",
            "removed_count": removed_count
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Cleanup failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Cleanup operation failed"
        )


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": "Internal Server Error",
            "message": "An unexpected error occurred"
        }
    )


# Custom exception handlers for specific cases
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Handle HTTP exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": "HTTP Error",
            "message": exc.detail
        }
    )