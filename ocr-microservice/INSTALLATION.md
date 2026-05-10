# OCR Microservice Installation Guide

## Overview

This guide provides instructions for installing and deploying the OCR Microservice for laboratory result extraction from hematology analyzer images.

## Prerequisites

### System Requirements

- **Operating System**: Linux (Ubuntu 20.04+ recommended)
- **Memory**: Minimum 2GB RAM, 4GB recommended
- **Storage**: 10GB free space for images and models
- **Python**: 3.11 or higher

### Dependencies

- Docker and Docker Compose (for containerized deployment)
- Git (for cloning the repository)

## Installation Options

### Option 1: Docker Deployment (Recommended)

1. **Clone the repository**:

   ```bash
   git clone <repository-url>
   cd ocr-microservice
   ```

2. **Configure environment**:

   ```bash
   cp .env.example .env
   # Edit .env file with your settings
   ```

3. **Build and run with Docker Compose**:

   ```bash
   docker-compose up -d
   ```

4. **Verify deployment**:
   ```bash
   curl http://localhost:8000/health
   ```

### Option 2: Local Python Installation

1. **Install Python dependencies**:

   ```bash
   pip install -r requirements.txt
   ```

2. **Install system dependencies** (Ubuntu/Debian):

   ```bash
   sudo apt-get update
   sudo apt-get install -y tesseract-ocr tesseract-ocr-eng
   ```

3. **Configure environment**:

   ```bash
   cp .env.example .env
   # Edit .env file
   ```

4. **Run the service**:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```

## Configuration

### Environment Variables

| Variable                         | Default     | Description                      |
| -------------------------------- | ----------- | -------------------------------- |
| `ENVIRONMENT`                    | development | Application environment          |
| `LOG_LEVEL`                      | INFO        | Logging level                    |
| `UPLOAD_DIR`                     | ./uploads   | Directory for uploaded images    |
| `RESULTS_DIR`                    | ./results   | Directory for extraction results |
| `MAX_FILE_SIZE`                  | 10485760    | Maximum file size (10MB)         |
| `OCR_TIMEOUT`                    | 30          | OCR processing timeout (seconds) |
| `PADDLE_CONFIDENCE_THRESHOLD`    | 0.7         | Minimum confidence for PaddleOCR |
| `TESSERACT_CONFIDENCE_THRESHOLD` | 0.6         | Minimum confidence for Tesseract |

### Directory Structure

After installation, the service creates the following directories:

```
ocr-microservice/
├── uploads/          # Original uploaded images
├── processed/        # Preprocessed images
├── results/          # JSON extraction results
├── debug/           # Debug images and logs
└── logs/            # Application logs
```

## API Usage

### Health Check

```bash
curl http://localhost:8000/health
```

### Get Supported Devices

```bash
curl http://localhost:8000/supported-devices
```

### Extract Results

```bash
curl -X POST http://localhost:8000/extract-results \
  -F "accession_id=ACC-2026-0001" \
  -F "image=@analyzer_image.jpg"
```

### Get Previous Results

```bash
curl http://localhost:8000/results/ACC-2026-0001
```

## Integration with LIMS

### Node.js Integration Example

```javascript
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");

async function extractResults(accessionId, imagePath) {
  const form = new FormData();
  form.append("accession_id", accessionId);
  form.append("image", fs.createReadStream(imagePath));

  try {
    const response = await axios.post(
      "http://localhost:8000/extract-results",
      form,
      {
        headers: form.getHeaders(),
        timeout: 60000, // 60 seconds
      },
    );

    return response.data;
  } catch (error) {
    console.error("OCR extraction failed:", error.message);
    throw error;
  }
}
```

### Error Handling

The service returns structured error responses:

```json
{
  "success": false,
  "error": "HTTP Error",
  "message": "File size exceeds maximum allowed size"
}
```

## Monitoring and Maintenance

### Health Monitoring

- Use the `/health` endpoint for service monitoring
- Monitor memory usage and disk space
- Set up alerts for high error rates

### Log Management

- Logs are stored in `logs/ocr_microservice.log`
- Configure log rotation for production
- Monitor for OCR failures and low confidence extractions

### File Cleanup

- Use the `/cleanup` endpoint to remove old files:
  ```bash
  curl -X POST http://localhost:8000/cleanup?days_old=30
  ```

### Performance Tuning

- Adjust `MAX_CONCURRENT_REQUESTS` based on server capacity
- Monitor OCR processing times
- Optimize image preprocessing parameters

## Troubleshooting

### Common Issues

1. **OCR Processing Timeout**
   - Increase `OCR_TIMEOUT` in environment variables
   - Check server resources (CPU, memory)

2. **Low OCR Confidence**
   - Ensure images are well-lit and focused
   - Check image preprocessing parameters
   - Consider device-specific template tuning

3. **Memory Issues**
   - Reduce `MAX_CONCURRENT_REQUESTS`
   - Increase server memory allocation
   - Monitor memory usage via `/health` endpoint

4. **Template Not Found**
   - Add new device templates to `config/templates/`
   - Restart the service to reload templates

### Debug Mode

Enable debug logging by setting `LOG_LEVEL=DEBUG` in the environment.

## Security Considerations

- The service should run behind a reverse proxy in production
- Implement authentication if required
- Regularly update dependencies for security patches
- Monitor for unusual access patterns
- Ensure uploaded files are properly validated

## Support

For issues and questions:

1. Check the application logs
2. Review the API documentation at `/docs`
3. Test with sample images
4. Contact the development team

## License

This software is provided as-is for laboratory use. Ensure compliance with local regulations for medical software deployment.
