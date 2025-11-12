# Stock Consumption API Guide

## Overview

The Stock Consumption API provides comprehensive functionality for tracking and managing inventory consumption across different scenarios including manual deductions, automatic test consumptions, and wastage recording. All consumption operations are tracked as inventory transactions with full audit trails.

## Base URL
```
/api/inventory/transactions
```

## Authentication
All endpoints require tenant ID to be passed as a query parameter: `?tenantId={number}`

## Endpoints

### 1. Unified Stock Consumption

**POST** `/consume`

Universal consumption endpoint that handles both single and bulk consumption. Automatically determines whether to use FIFO or manual consumption for each item based on whether batch information is provided.

**Single Consumption Request Body:**
```json
{
  "item_id": "INV-001",
  "quantity": 5,
  "reason": "Lab testing",
  "batch_number": "BATCH-2025-001",  // Optional - if provided, uses manual consumption
  "brand_name": "Brand A",           // Optional - if provided, uses manual consumption
  "performed_by": 123,
  "notes": "Optional notes"
}
```

**Bulk Consumption Request Body:**
```json
{
  "consumptions": [
    {
      "item_id": "INV-001",
      "quantity": 3,
      "reason": "Quality control",
      "batch_number": "BATCH-2025-001",  // Manual consumption
      "brand_name": "Brand A",
      "performed_by": 456
    },
    {
      "item_id": "INV-002",
      "quantity": 2,
      "reason": "FIFO consumption",      // No batch specified - uses FIFO
      "performed_by": 456
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "TXN-1735689600000",
    "item_id": "INV-001",
    "transaction_type": "consumption",
    "quantity": 5,
    "previous_stock": 100,
    "new_stock": 95,
    "reason": "Lab testing",
    "batch_number": "BATCH-2025-001",
    "brand_name": "Brand A",
    "performed_by": 123,
    "transaction_date": "2025-01-01T12:00:00.000Z",
    "consumption_method": "manual",
    "consumed_from_batch": "BATCH-2025-001",
    "consumed_brand": "Brand A",
    "notes": "Optional notes",
    "stock_remaining": 95
  }
}
```

**Consumption Method Logic:**
- **Manual**: Used when `batch_number` or `brand_name` is provided
- **FIFO**: Used when no batch information is provided (automatically selects oldest batch)

### 2. Automatic Test Consumption

**POST** `/consume/test`

Automatically records consumption when tests are performed. Typically called by test execution systems.

**Request Body:**
```json
{
  "test_id": "TEST-2025-001",
  "item_id": "INV-001",
  "quantity_used": 1,
  "test_type": "Blood Glucose Test",
  "patient_id": 12345,
  "ascension_id": 67890,
  "testid": 11111,
  "performed_by": 789,
  "batch_number": "BATCH-2025-001",
  "notes": "Patient ID: 12345"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "TXN-1735689600003",
    "item_id": "INV-001",
    "transaction_type": "consumption",
    "quantity": 1,
    "previous_stock": 47,
    "new_stock": 46,
    "reason": "Test consumption - Blood Glucose Test",
    "reference_id": "TEST-2025-001",
    "patient_id": 12345,
    "ascension_id": 67890,
    "testid": 11111,
    "batch_number": "BATCH-2025-001",
    "performed_by": 789,
    "transaction_date": "2025-01-01T12:00:00.000Z",
    "notes": "Patient ID: 12345",
    "stock_remaining": 46
  }
}
```

### 3. Record Wastage

**POST** `/wastage`

Records inventory wastage (expired, damaged, or spoiled items).

**Request Body:**
```json
{
  "item_id": "INV-001",
  "quantity": 2,
  "reason": "Expired reagents",
  "batch_number": "BATCH-2024-050",
  "performed_by": 101,
  "notes": "Batch expired on 2024-12-31"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "TXN-1735689600004",
    "item_id": "INV-001",
    "transaction_type": "consumption",
    "quantity": 2,
    "previous_stock": 46,
    "new_stock": 44,
    "reason": "Wastage - Expired reagents",
    "batch_number": "BATCH-2024-050",
    "performed_by": 101,
    "transaction_date": "2025-01-01T12:00:00.000Z",
    "notes": "Batch expired on 2024-12-31",
    "stock_remaining": 44
  }
}
```

### 4. Get Consumption Transactions

**GET** `/consumption/list`

Retrieves all consumption transactions with optional filtering.

**Query Parameters:**
- `page`: Page number (default: 1)
- `count`: Items per page (default: 10)
- `sortby`: Sort order - 'ASC' or 'DESC' (default: 'DESC')
- `item_id`: Filter by specific item
- `performed_by`: Filter by user who performed consumption
- `startDate`: Start date (YYYY-MM-DD)
- `endDate`: End date (YYYY-MM-DD)
- `batch_number`: Filter by batch number

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [...],
    "total": 25,
    "page": 1,
    "count": 10,
    "totalPages": 3,
    "sortby": "DESC"
  },
  "pagination": {
    "page": 1,
    "count": 10,
    "total": 25,
    "totalPages": 3,
    "sortby": "DESC"
  }
}
```

### 5. Get Consumption Report

**GET** `/consumption/report`

Retrieves comprehensive consumption reports with filtering and summary statistics.

**Query Parameters:**
- `page`: Page number (default: 1)
- `count`: Items per page (default: 10)
- `sortby`: Sort order - 'ASC' or 'DESC' (default: 'DESC')
- `item_id`: Filter by specific item
- `performed_by`: Filter by user who performed consumption
- `startDate`: Start date (YYYY-MM-DD)
- `endDate`: End date (YYYY-MM-DD)
- `reason`: Filter by reason text

**Response:**
```json
{
  "success": true,
  "data": {
    "consumptions": [
      {
        "id": "TXN-1735689600001",
        "item_id": "INV-001",
        "item_name": "Glucose Test Strips",
        "item_sku": "GTS-001",
        "consumption_type": "manual",
        "quantity": 5,
        "reason": "Used for lab preparation",
        "batch_number": "BATCH-2025-001",
        "patient_id": 12345,
        "ascension_id": 67890,
        "testid": 11111,
        "performed_by": 123,
        "transaction_date": "2025-01-01T12:00:00.000Z",
        "notes": "Optional additional notes"
      }
    ],
    "total": 1,
    "page": 1,
    "count": 10,
    "totalPages": 1,
    "sortby": "DESC",
    "summary": {
      "total_consumptions": 1,
      "manual_consumptions": 1,
      "test_consumptions": 0,
      "wastage_consumptions": 0,
      "total_quantity_consumed": 5,
      "period_start": "2024-12-01",
      "period_end": "2025-01-01"
    }
  },
  "pagination": {
    "page": 1,
    "count": 10,
    "total": 1,
    "totalPages": 1,
    "sortby": "DESC"
  }
}
```

## Error Handling

### Validation Errors
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Quantity must be greater than 0"
  }
}
```

### Insufficient Stock
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Insufficient stock. Requested: 10, Available: 5"
  }
}
```

### Item Not Found
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Inventory item not found or inactive"
  }
}
```

## Business Rules

1. **Stock Validation**: All consumption requests validate available stock before processing
2. **Transaction Logging**: Every consumption creates a complete audit trail
3. **Unified Consumption Logic**: The `/consume` endpoint automatically determines consumption method:
   - **Manual**: Used when `batch_number` or `brand_name` is provided in the request
   - **FIFO**: Used when no batch information is provided (automatically selects oldest batch)
4. **Batch Tracking**: Optional batch number tracking for traceability and targeted consumption
5. **Brand Tracking**: Optional brand name tracking for consumption specificity
6. **FIFO Support**: Automatic consumption from oldest available batch when requested
7. **Employee Tracking**: All consumptions are attributed to specific users
8. **Patient Tracking**: Test consumptions require patient_id and ascension_id for proper tracking
9. **Test ID Tracking**: Optional testid field for enhanced test consumption tracking
10. **Available Stock Information**: Detailed batch and brand information available for informed consumption decisions
11. **Reason Documentation**: Consumption reasons help categorize usage types
12. **Automatic Updates**: Inventory stock levels are automatically updated
13. **Type Classification**: Consumptions are automatically classified as manual, test, or wastage

## Integration Examples

### JavaScript/Node.js
```javascript
// Single item consumption with FIFO (no batch specified)
const singleFIFOResponse = await fetch('/api/inventory/transactions/consume?tenantId=1', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    item_id: 'INV-001',
    quantity: 3,
    reason: 'FIFO consumption',
    performed_by: 123
  })
});

// Single item consumption with manual batch selection
const singleManualResponse = await fetch('/api/inventory/transactions/consume?tenantId=1', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    item_id: 'INV-001',
    quantity: 5,
    reason: 'Manual consumption',
    batch_number: 'BATCH-2025-001',
    brand_name: 'Brand A',
    performed_by: 123
  })
});

// Bulk consumption with mixed FIFO and manual methods
const bulkResponse = await fetch('/api/inventory/transactions/consume?tenantId=1', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    consumptions: [
      {
        item_id: 'INV-001',
        quantity: 3,
        reason: 'FIFO consumption',  // No batch specified - uses FIFO
        performed_by: 456
      },
      {
        item_id: 'INV-002',
        quantity: 2,
        reason: 'Manual consumption',
        batch_number: 'BATCH-2025-002',  // Batch specified - uses manual
        brand_name: 'Brand B',
        performed_by: 456
      }
    ]
  })
});

// Get available stock details before consumption
const stockDetails = await fetch('/api/inventory/transactions/available-stock/INV-001?tenantId=1');
const stockInfo = await stockDetails.json();

// Automatic test consumption with batch/brand
const testResponse = await fetch('/api/inventory/transactions/consume/test?tenantId=1', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    test_id: 'TEST-001',
    item_id: 'INV-001',
    quantity_used: 1,
    test_type: 'Glucose Test',
    patient_id: 12345,
    ascension_id: 67890,
    testid: 11111,
    batch_number: 'BATCH-2025-001',
    brand_name: 'Brand A',
    performed_by: 789
  })
});
```

### Python
```python
import requests

# Single item consumption with FIFO
single_fifo = requests.post(
    '/api/inventory/transactions/consume?tenantId=1',
    json={
        'item_id': 'INV-001',
        'quantity': 3,
        'reason': 'FIFO consumption',
        'performed_by': 123
    }
)

# Single item consumption with manual batch
single_manual = requests.post(
    '/api/inventory/transactions/consume?tenantId=1',
    json={
        'item_id': 'INV-001',
        'quantity': 5,
        'reason': 'Manual consumption',
        'batch_number': 'BATCH-2025-001',
        'brand_name': 'Brand A',
        'performed_by': 123
    }
)

# Bulk consumption with mixed methods
bulk_mixed = requests.post(
    '/api/inventory/transactions/consume?tenantId=1',
    json={
        'consumptions': [
            {
                'item_id': 'INV-001',
                'quantity': 3,
                'reason': 'FIFO consumption',  # No batch - uses FIFO
                'performed_by': 456
            },
            {
                'item_id': 'INV-002',
                'quantity': 2,
                'reason': 'Manual consumption',
                'batch_number': 'BATCH-2025-002',  # Batch specified - uses manual
                'brand_name': 'Brand B',
                'performed_by': 456
            }
        ]
    }
)

# Get available stock details
stock_response = requests.get('/api/inventory/transactions/available-stock/INV-001?tenantId=1')
stock_data = stock_response.json()

# Test consumption with batch/brand
test_response = requests.post(
    '/api/inventory/transactions/consume/test?tenantId=1',
    json={
        'test_id': 'TEST-001',
        'item_id': 'INV-001',
        'quantity_used': 1,
        'test_type': 'Glucose Test',
        'patient_id': 12345,
        'ascension_id': 67890,
        'testid': 11111,
        'batch_number': 'BATCH-2025-001',
        'brand_name': 'Brand A',
        'performed_by': 789
    }
)

# Get consumption report
report = requests.get(
    '/api/inventory/transactions/consumption/report?tenantId=1&startDate=2025-01-01'
)
```

## Data Types

- **Consumption Types**: `manual`, `test`, `wastage`
- **Consumption Methods**: `fifo`, `manual` (returned in unified endpoint responses)
- **Quantities**: Positive integers only
- **Dates**: ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)
- **User IDs**: Numeric employee identifiers
- **Patient IDs**: Integer patient identifiers (required for test consumption)
- **Ascension IDs**: Integer ascension identifiers (required for test consumption)
- **Test IDs**: Integer test identifiers (optional for test consumption)
- **Batch Numbers**: Optional string identifiers for batch tracking
- **Brand Names**: Optional string identifiers for brand tracking
- **Reasons**: Free text descriptions of consumption purpose
- **Available Stock Details**: Structured information about batches and brands with quantities and expiry dates

## Performance Considerations

- Bulk operations are preferred for multiple consumptions
- Reports support pagination for large datasets
- Database indexes optimize common query patterns
- Transaction isolation ensures data consistency</content>
<parameter name="filePath">c:\Programming\PLS-DIFFERENT-VERSIONS\LobnosProfessionalVersion\lobnos-server\docs\stock-consumption-api.md