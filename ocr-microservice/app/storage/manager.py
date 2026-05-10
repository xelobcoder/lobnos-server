"""File storage manager for handling uploads, processed images, and results."""

import asyncio
import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

import aiofiles

from app.core.config import settings
from app.core.logging import logger


class FileStorageManager:
    """Manages file storage operations for the OCR microservice."""

    def __init__(self):
        """Initialize the storage manager."""
        self.upload_dir = settings.upload_dir
        self.processed_dir = settings.processed_dir
        self.results_dir = settings.results_dir
        self.debug_dir = settings.debug_dir

    async def save_uploaded_image(self, image_data: bytes, accession_id: str, filename: str) -> Path:
        """
        Save uploaded image to the uploads directory.

        Args:
            image_data: Raw image bytes
            accession_id: Laboratory accession identifier
            filename: Original filename

        Returns:
            Path to saved file
        """
        # Create directory structure: uploads/YYYY/MM/
        date_path = self._get_date_path()
        upload_path = self.upload_dir / date_path
        upload_path.mkdir(parents=True, exist_ok=True)

        # Create filename with accession ID
        file_extension = Path(filename).suffix.lower()
        safe_filename = f"{accession_id}_original{file_extension}"
        file_path = upload_path / safe_filename

        try:
            async with aiofiles.open(file_path, 'wb') as f:
                await f.write(image_data)

            logger.info(f"Saved uploaded image: {file_path}")
            return file_path

        except Exception as e:
            logger.error(f"Failed to save uploaded image: {e}")
            raise

    async def save_processed_image(self, image_bytes: bytes, accession_id: str, suffix: str = "processed") -> Path:
        """
        Save processed image to the processed directory.

        Args:
            image_bytes: Processed image bytes
            accession_id: Laboratory accession identifier
            suffix: Filename suffix

        Returns:
            Path to saved file
        """
        # Create directory structure: processed/YYYY/MM/
        date_path = self._get_date_path()
        processed_path = self.processed_dir / date_path
        processed_path.mkdir(parents=True, exist_ok=True)

        # Create filename
        filename = f"{accession_id}_{suffix}.png"
        file_path = processed_path / filename

        try:
            async with aiofiles.open(file_path, 'wb') as f:
                await f.write(image_bytes)

            logger.debug(f"Saved processed image: {file_path}")
            return file_path

        except Exception as e:
            logger.error(f"Failed to save processed image: {e}")
            raise

    async def save_extraction_result(self, result_data: Dict, accession_id: str) -> Path:
        """
        Save extraction result as JSON file.

        Args:
            result_data: Extraction result dictionary
            accession_id: Laboratory accession identifier

        Returns:
            Path to saved JSON file
        """
        # Create directory structure: results/YYYY/MM/
        date_path = self._get_date_path()
        results_path = self.results_dir / date_path
        results_path.mkdir(parents=True, exist_ok=True)

        # Create filename
        filename = f"{accession_id}.json"
        file_path = results_path / filename

        try:
            # Convert to JSON with proper formatting
            json_data = json.dumps(result_data, indent=2, default=str)

            async with aiofiles.open(file_path, 'w', encoding='utf-8') as f:
                await f.write(json_data)

            logger.info(f"Saved extraction result: {file_path}")
            return file_path

        except Exception as e:
            logger.error(f"Failed to save extraction result: {e}")
            raise

    async def save_debug_image(self, image_bytes: bytes, accession_id: str, debug_type: str) -> Path:
        """
        Save debug image to the debug directory.

        Args:
            image_bytes: Debug image bytes
            accession_id: Laboratory accession identifier
            debug_type: Type of debug image (e.g., 'preprocessed', 'thresholded')

        Returns:
            Path to saved file
        """
        # Create directory structure: debug/YYYY/MM/
        date_path = self._get_date_path()
        debug_path = self.debug_dir / date_path
        debug_path.mkdir(parents=True, exist_ok=True)

        # Create filename
        filename = f"{accession_id}_{debug_type}.png"
        file_path = debug_path / filename

        try:
            async with aiofiles.open(file_path, 'wb') as f:
                await f.write(image_bytes)

            logger.debug(f"Saved debug image: {file_path}")
            return file_path

        except Exception as e:
            logger.error(f"Failed to save debug image: {e}")
            raise

    def _get_date_path(self) -> Path:
        """Get date-based path for file organization."""
        now = datetime.now()
        return Path(f"{now.year:04d}") / f"{now.month:02d}"

    async def get_result_file_path(self, accession_id: str) -> Optional[Path]:
        """
        Get the path to an existing result file.

        Args:
            accession_id: Laboratory accession identifier

        Returns:
            Path to result file if exists, None otherwise
        """
        # Search in recent date directories
        now = datetime.now()
        search_paths = []

        # Current month
        search_paths.append(self.results_dir / f"{now.year:04d}" / f"{now.month:02d}")

        # Previous month (in case of date boundary issues)
        if now.month == 1:
            prev_year = now.year - 1
            prev_month = 12
        else:
            prev_year = now.year
            prev_month = now.month - 1

        search_paths.append(self.results_dir / f"{prev_year:04d}" / f"{prev_month:02d}")

        for search_path in search_paths:
            if search_path.exists():
                result_file = search_path / f"{accession_id}.json"
                if result_file.exists():
                    return result_file

        return None

    async def load_result_file(self, accession_id: str) -> Optional[Dict]:
        """
        Load an existing result file.

        Args:
            accession_id: Laboratory accession identifier

        Returns:
            Result data if file exists, None otherwise
        """
        file_path = await self.get_result_file_path(accession_id)
        if not file_path:
            return None

        try:
            async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                content = await f.read()
                return json.loads(content)
        except Exception as e:
            logger.error(f"Failed to load result file {file_path}: {e}")
            return None

    async def cleanup_old_files(self, days_old: int = 30) -> int:
        """
        Clean up old files from storage directories.

        Args:
            days_old: Remove files older than this many days

        Returns:
            Number of files removed
        """
        cutoff_date = datetime.now().timestamp() - (days_old * 24 * 60 * 60)
        removed_count = 0

        # Clean debug and processed directories (keep results)
        directories_to_clean = [self.debug_dir, self.processed_dir]

        for directory in directories_to_clean:
            if not directory.exists():
                continue

            for file_path in directory.rglob("*"):
                if file_path.is_file():
                    try:
                        if file_path.stat().st_mtime < cutoff_date:
                            file_path.unlink()
                            removed_count += 1
                    except Exception as e:
                        logger.error(f"Failed to remove old file {file_path}: {e}")

        logger.info(f"Cleaned up {removed_count} old files")
        return removed_count

    def get_storage_stats(self) -> Dict:
        """Get storage usage statistics."""
        stats = {
            "uploads": self._get_directory_stats(self.upload_dir),
            "processed": self._get_directory_stats(self.processed_dir),
            "results": self._get_directory_stats(self.results_dir),
            "debug": self._get_directory_stats(self.debug_dir),
        }

        return stats

    def _get_directory_stats(self, directory: Path) -> Dict:
        """Get statistics for a directory."""
        if not directory.exists():
            return {"files": 0, "size_bytes": 0}

        total_files = 0
        total_size = 0

        try:
            for file_path in directory.rglob("*"):
                if file_path.is_file():
                    total_files += 1
                    total_size += file_path.stat().st_size
        except Exception as e:
            logger.error(f"Failed to get stats for {directory}: {e}")

        return {
            "files": total_files,
            "size_bytes": total_size,
            "size_mb": round(total_size / (1024 * 1024), 2),
        }


# Global storage manager instance
storage_manager = FileStorageManager()