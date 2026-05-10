# OCR Microservice for Laboratory Information Systems

A production-grade offline OCR microservice for extracting hematology analyzer results from images. Built with FastAPI, PaddleOCR, and OpenCV for reliable laboratory data extraction.

## Features

- **Offline Processing**: No internet dependency for OCR operations
- **Dual OCR Engines**: PaddleOCR primary with Tesseract fallback
- **Template-Based Extraction**: Device-specific coordinate mapping for accurate field extraction
- **Medical Validation**: Built-in validation rules for hematology parameters
- **Comprehensive Preprocessing**: OpenCV-powered image optimization
- **RESTful API**: Clean FastAPI interface for easy integration
- **Docker Ready**: Containerized deployment with docker-compose
- **Structured Logging**: Detailed logging with performance metrics
- **File Management**: Automatic organization and cleanup of images and results

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Node.js LIMS  │───▶│  OCR Microservice │───▶│   JSON Results  │
│                 │    │                  │    │                 │
│ • Upload Images │    │ • Image Preproc. │    │ • WBC: 6.5      │
│ • Get Results   │    │ • OCR Extraction │    │ • RBC: 4.2      │
└─────────────────┘    │ • Validation      │    │ • HGB: 13.2     │
                       │ • File Storage    │    └─────────────────┘
                       └──────────────────┘
```

## Quick Start

### Docker Deployment (Recommended)

```bash
# Clone and setup
git clone <repository-url>
cd ocr-microservice

# Configure environment
cp .env.example .env

# Deploy with Docker
docker-compose up -d

# Check health
curl http://localhost:8000/health
```

### API Usage

```bash
# Extract results from analyzer image
curl -X POST http://localhost:8000/extract-results \
  -F "accession_id=ACC-2026-0001" \
  -F "image=@analyzer_screen.jpg"
```

Response:

```json
{
  "success": true,
  "accession_id": "ACC-2026-0001",
  "device": "Licare Hematology Analyzer",
  "confidence_score": 0.92,
  "results": {
    "WBC": {
      "value": 6.5,
      "unit": "10^9/L",
      "confidence": 0.95,
      "status": "VALID"
    },
    "RBC": {
      "value": 4.2,
      "unit": "10^12/L",
      "confidence": 0.91,
      "status": "VALID"
    },
    "HGB": {
      "value": 13.2,
      "unit": "g/dL",
      "confidence": 0.94,
      "status": "VALID"
    }
  }
}
```

## Supported Analyzers

- Licare Hematology Analyzer (pre-configured)
- Extensible template system for additional devices

## API Endpoints

| Method | Endpoint                  | Description                   |
| ------ | ------------------------- | ----------------------------- |
| GET    | `/health`                 | Service health check          |
| GET    | `/supported-devices`      | List supported analyzers      |
| POST   | `/extract-results`        | Extract parameters from image |
| GET    | `/results/{accession_id}` | Retrieve saved results        |
| POST   | `/cleanup`                | Clean up old files            |

## Configuration

### Environment Variables

```bash
# Application
ENVIRONMENT=production
LOG_LEVEL=INFO

# OCR Settings
OCR_TIMEOUT=30
PADDLE_CONFIDENCE_THRESHOLD=0.7
TESSERACT_CONFIDENCE_THRESHOLD=0.6

# File Storage
UPLOAD_DIR=./uploads
RESULTS_DIR=./results
MAX_FILE_SIZE=10485760
```

### Adding New Device Templates

1. Create template JSON in `config/templates/`
2. Define field coordinates and validation rules
3. Restart service to load new templates

Example template:

```json
{
  "device_name": "New Analyzer Model",
  "fields": {
    "WBC": { "x1": 100, "y1": 150, "x2": 200, "y2": 180 }
  },
  "validation_rules": {
    "WBC": { "min": 0, "max": 50, "unit": "10^9/L" }
  }
}
```

## Development

### Local Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Install Tesseract OCR
sudo apt-get install tesseract-ocr tesseract-ocr-eng

# Run development server
uvicorn app.main:app --reload
```

### Testing

```bash
# Run unit tests
pytest tests/

# Run with coverage
pytest --cov=app tests/
```

### Code Quality

```bash
# Format code
black app/ tests/

# Sort imports
isort app/ tests/

# Type checking
mypy app/
```

## Performance

- **Processing Time**: < 3 seconds per image
- **Memory Usage**: ~500MB base + ~200MB per concurrent request
- **Concurrent Requests**: Configurable (default: 5)
- **Image Size**: Up to 10MB, auto-resized to 2000x2000px

## Security

- Input validation and sanitization
- File type verification
- Size limits and rate limiting
- Structured error responses
- No external API dependencies

## Monitoring

- Health check endpoint with system metrics
- Structured logging with performance data
- Automatic file cleanup
- Configurable log levels

## License

This software is designed for laboratory use. Ensure compliance with local medical software regulations.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## Support

- API Documentation: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/health`
- Logs: `logs/ocr_microservice.log`
