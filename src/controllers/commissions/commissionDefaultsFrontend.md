# Commission Defaults Frontend Integration

This document describes how the frontend should structure API calls to interact with the Commission Defaults endpoints in the Lobnos LIMS backend.

## API Endpoints

The Commission Defaults API provides the following endpoints:

### 1. Get All Commission Defaults

- **Method**: GET
- **URL**: `commission-defaults`
- **Query Parameters**:
  - `tenantId` (required): The tenant ID for multi-tenancy support
- **Response**: Array of commission default objects

### 2. Create Commission Default

- **Method**: POST
- **URL**: `commission-defaults`
- **Headers**:
  - `Content-Type: application/json`
- **Body**: Commission default object (without ID)
- **Query Parameters**:
  - `tenantId` (required): The tenant ID for multi-tenancy support
- **Response**: Created commission default object

### 3. Update Commission Default by ID

- **Method**: PUT
- **URL**: `commission-defaults/:id`
- **Headers**:
  - `Content-Type: application/json`
- **Body**: Updated commission default object
- **Query Parameters**:
  - `tenantId` (required): The tenant ID for multi-tenancy support
- **Response**: Updated commission default object

## Frontend Implementation Examples

### Using Fetch API

```javascript
// Get all commission defaults
async function getCommissionDefaults(tenantId) {
  try {
    const response = await fetch(
      `commission-defaults?tenantId=${tenantId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${getAuthToken()}`, // Include JWT token if required
        },
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.result || data;
  } catch (error) {
    console.error("Error fetching commission defaults:", error);
    throw error;
  }
}

// Create a new commission default
async function createCommissionDefault(tenantId, commissionData) {
  try {
    const response = await fetch(
      `commission-defaults?tenantId=${tenantId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify(commissionData),
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.result || data;
  } catch (error) {
    console.error("Error creating commission default:", error);
    throw error;
  }
}

// Update a commission default
async function updateCommissionDefault(tenantId, id, commissionData) {
  try {
    const response = await fetch(
      `commission-defaults/${id}?tenantId=${tenantId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify(commissionData),
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.result || data;
  } catch (error) {
    console.error("Error updating commission default:", error);
    throw error;
  }
}
```

### Using Axios

```javascript
import axios from "axios";

// Configure axios instance with base URL and default headers
const apiClient = axios.create({
  baseURL: "/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

// Add request interceptor for authentication
apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Get all commission defaults
async function getCommissionDefaults(tenantId) {
  try {
    const response = await apiClient.get("/commission-defaults", {
      params: { tenantId },
    });
    return response.data.result || response.data;
  } catch (error) {
    console.error("Error fetching commission defaults:", error);
    throw error;
  }
}

// Create a new commission default
async function createCommissionDefault(tenantId, commissionData) {
  try {
    const response = await apiClient.post(
      "/commission-defaults",
      commissionData,
      {
        params: { tenantId },
      },
    );
    return response.data.result || response.data;
  } catch (error) {
    console.error("Error creating commission default:", error);
    throw error;
  }
}

// Update a commission default
async function updateCommissionDefault(tenantId, id, commissionData) {
  try {
    const response = await apiClient.put(
      `/commission-defaults/${id}`,
      commissionData,
      {
        params: { tenantId },
      },
    );
    return response.data.result || response.data;
  } catch (error) {
    console.error("Error updating commission default:", error);
    throw error;
  }
}
```

## Error Handling

All endpoints follow the standard Lobnos API response format:

**Success Response**:

```json
{
  "status": "success",
  "statusCode": 200,
  "message": "Operation completed successfully",
  "result": {
    /* data */
  }
}
```

**Error Response**:

```json
{
  "status": "error",
  "statusCode": 400,
  "message": "Error description"
}
```
