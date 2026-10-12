# License Renewal Go Application

This Go application is designed to renew the license for the Prime Laboratory Software (PLS) server by making an API call to the license add endpoint.

## Prerequisites

- Go 1.21 or later installed on the system

## Configuration

Create a `.env` file in the same directory as the executable with the following variables:

```env
SERVER_URL=http://your-server.com
TENANT_ID=123
START_PERIOD=2025-01-01T00:00:00Z
END_PERIOD=2026-01-01T00:00:00Z
WINDOW_DAYS=30
LOGIN_DURATION_PER_USER=6
```

## Command-Line Arguments

You can override the start and end periods from the `.env` file by specifying them when running the application:

- `-start`: Start period in ISO 8601 format (e.g., "2025-01-01T00:00:00Z")
- `-end`: End period in ISO 8601 format (e.g., "2026-01-01T00:00:00Z")

If not provided, the application will use the values from the `.env` file.

## Building the Application

First, install dependencies:

```bash
go mod tidy
```

Then build the application:

```bash
go build -o license-renewal main.go
```

This will create an executable file named `license-renewal` (or `license-renewal.exe` on Windows).

## Running the Application

After building, run the executable with optional date parameters:

```bash
# Using default dates (now to 1 year from now)
./license-renewal

# Specifying custom dates
./license-renewal -start="2025-01-01T00:00:00Z" -end="2026-01-01T00:00:00Z"
```

The application will:
1. Load configuration from `.env` file
2. Use provided command-line dates or defaults
3. Make a POST request to renew the license
4. Print the response status and result

## Usage Flow

1. **Configure**: Update the `.env` file with client-specific settings
2. **Build**: Compile the application for the client's platform
3. **Send to client**: Provide the executable and `.env` file
4. **Client runs**: Execute with desired license period dates

## API Endpoint

The application calls: `POST /api/v1/security/license/add?tenantId={tenantId}`

With JSON body containing the license details.