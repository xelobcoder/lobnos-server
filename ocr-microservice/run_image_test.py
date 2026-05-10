import asyncio
import json
from pathlib import Path

from app.services.extraction import extraction_service


def main():
    file_path = Path('test-uploads/licare-test.jpg')
    if not file_path.exists():
        raise FileNotFoundError(f'Test image not found: {file_path}')

    image_data = file_path.read_bytes()

    async def run_test():
        result = await extraction_service.extract_results(
            image_data=image_data,
            accession_id='TEST-2026-0001',
            original_filename=file_path.name,
        )
        print(json.dumps(result.model_dump(), indent=2, default=str))

    asyncio.run(run_test())


if __name__ == '__main__':
    main()
