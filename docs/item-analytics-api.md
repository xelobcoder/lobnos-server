# Inventory Item Analytics API Documentation

This document describes the item-specific analytics endpoints available in the Lobnos Server API. These endpoints provide detailed analytics for individual inventory items.

## Base URL
```
/api/v1/inventory/analytics/items/:itemId
```

## Authentication
All endpoints require authentication via JWT token in the `pls-prime-tenant-session` cookie.

## Common Parameters

### Required Query Parameters
- `tenantId` (number): The tenant identifier for multi-tenant data isolation

### Path Parameters
- `itemId` (string): The unique identifier of the inventory item

### Optional Query Parameters
- `startDate` (string): Start date for filtering data (YYYY-MM-DD format)
- `endDate` (string): End date for filtering data (YYYY-MM-DD format)
- `supplierId` (string): Supplier ID for supplier-specific analytics (only for supplier endpoints)

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "Description of the retrieved data",
  "data": {
    // Response data varies by endpoint
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error": {
    "code": "ERROR_CODE",
    "message": "Detailed error message"
  }
}
```

## Endpoints

### 1. Item Analytics Summary
**GET** `/api/v1/inventory/analytics/items/:itemId/summary`

Retrieves comprehensive analytics summary for a specific inventory item.

**Response Data Structure:**
```json
{
  "total_orders_received": 25,
  "total_quantity_received": 1500.50,
  "total_amount_received": 75000.00,
  "total_consumed_quantity": 1200.25,
  "total_consumed_amount": 60000.00,
  "total_wasted_quantity": 50.75,
  "total_wasted_amount": 2500.00,
  "average_daily_consumption_quantity": 4.17,
  "average_daily_consumption_amount": 208.33,
  "supplier_count": 3,
  "test_consumption_variance_percent": 85.5
}
```

### 2. Item Order Analytics
**GET** `/api/v1/inventory/analytics/items/:itemId/orders`

Retrieves order analytics grouped by daily, monthly, and yearly periods.

**Response Data Structure:**
```json
[
  {
    "period": "2025-01-15",
    "period_type": "daily",
    "quantity": 100.00,
    "amount": 5000.00
  },
  {
    "period": "2025-01",
    "period_type": "monthly",
    "quantity": 2500.00,
    "amount": 125000.00
  },
  {
    "period": "2025",
    "period_type": "yearly",
    "quantity": 30000.00,
    "amount": 1500000.00
  }
]
```

### 3. Daily Order Analytics
**GET** `/api/v1/inventory/analytics/items/:itemId/orders/daily`

Retrieves daily order analytics for the item.

**Response Data Structure:** Same as Item Order Analytics but only daily periods.

### 4. Monthly Order Analytics
**GET** `/api/v1/inventory/analytics/items/:itemId/orders/monthly`

Retrieves monthly order analytics for the item.

**Response Data Structure:** Same as Item Order Analytics but only monthly periods.

### 5. Yearly Order Analytics
**GET** `/api/v1/inventory/analytics/items/:itemId/orders/yearly`

Retrieves yearly order analytics for the item.

**Response Data Structure:** Same as Item Order Analytics but only yearly periods.

### 6. Item Usage Analytics
**GET** `/api/v1/inventory/analytics/items/:itemId/usage`

Retrieves consumption analytics grouped by daily, monthly, and yearly periods.

**Response Data Structure:** Same as Item Order Analytics.

### 7. Daily Consumption Analytics
**GET** `/api/v1/inventory/analytics/items/:itemId/usage/daily`

Retrieves daily consumption analytics for the item.

**Response Data Structure:** Same as Item Order Analytics but only daily periods.

### 8. Monthly Consumption Analytics
**GET** `/api/v1/inventory/analytics/items/:itemId/usage/monthly`

Retrieves monthly consumption analytics for the item.

**Response Data Structure:** Same as Item Order Analytics but only monthly periods.

### 9. Yearly Consumption Analytics
**GET** `/api/v1/inventory/analytics/items/:itemId/usage/yearly`

Retrieves yearly consumption analytics for the item.

**Response Data Structure:** Same as Item Order Analytics but only yearly periods.

### 10. Item Wastage Analytics
**GET** `/api/v1/inventory/analytics/items/:itemId/wastage`

Retrieves wastage analytics grouped by daily, monthly, and yearly periods.

**Response Data Structure:** Same as Item Order Analytics.

### 11. Daily Wastage Analytics
**GET** `/api/v1/inventory/analytics/items/:itemId/wastage/daily`

Retrieves daily wastage analytics for the item.

**Response Data Structure:** Same as Item Order Analytics but only daily periods.

### 12. Monthly Wastage Analytics
**GET** `/api/v1/inventory/analytics/items/:itemId/wastage/monthly`

Retrieves monthly wastage analytics for the item.

**Response Data Structure:** Same as Item Order Analytics but only monthly periods.

### 13. Yearly Wastage Analytics
**GET** `/api/v1/inventory/analytics/items/:itemId/wastage/yearly`

Retrieves yearly wastage analytics for the item.

**Response Data Structure:** Same as Item Order Analytics but only yearly periods.

### 14. Supplier-Specific Analytics
**GET** `/api/v1/inventory/analytics/items/:itemId/suppliers`

Retrieves analytics for each supplier that provides this item, grouped by periods.

**Optional Query Parameters:**
- `supplierId` (string): Filter by specific supplier

**Response Data Structure:**
```json
[
  {
    "supplier_id": "SUP001",
    "supplier_name": "ABC Medical Supplies",
    "period": "2025-01-15",
    "period_type": "daily",
    "quantity": 50.00,
    "amount": 2500.00
  }
]
```

### 15. Supplier Performance Metrics
**GET** `/api/v1/inventory/analytics/items/:itemId/supplier-performance`

Retrieves performance metrics for all suppliers of this item.

**Response Data Structure:**
```json
[
  {
    "supplier_id": "SUP001",
    "supplier_name": "ABC Medical Supplies",
    "total_deliveries": 25,
    "total_quantity_received": 1250.00,
    "total_amount": 62500.00,
    "avg_lead_time_days": 3.2,
    "min_lead_time_days": 1,
    "max_lead_time_days": 7,
    "on_time_delivery_rate_percent": 92.0,
    "rejection_rate_percent": 2.5,
    "failed_qc_count": 1,
    "price_stability_stddev": 15.50,
    "dependency_risk_percent": 45.0,
    "is_single_source": false
  }
]
```

### 16. Test Consumption Analytics
**GET** `/api/v1/inventory/analytics/items/:itemId/test-consumption`

Retrieves analytics comparing expected vs actual consumption in laboratory tests.

**Response Data Structure:**
```json
[
  {
    "period": "2025-01-15",
    "period_type": "daily",
    "test_id": 123,
    "test_name": "Complete Blood Count",
    "completed_tests_count": 45,
    "expected_consumption_quantity": 22.50,
    "actual_consumption_quantity_linked": 20.25,
    "variance_quantity": -2.25,
    "actual_vs_expected_percent": 90.0
  }
]
```

### 17. Average Consumption
**GET** `/api/v1/inventory/analytics/items/:itemId/average-consumption`

Retrieves average daily consumption metrics for the item.

**Response Data Structure:**
```json
{
  "average_daily_consumption_quantity": 4.17,
  "average_daily_consumption_amount": 208.33
}
```

## Error Codes

- `MISSING_ITEM_ID`: Item ID parameter is required
- `INVALID_DATE_FORMAT`: Date parameters must be in YYYY-MM-DD format
- `INTERNAL_ERROR`: Server-side error occurred

## Date Filtering

When `startDate` and/or `endDate` are provided:
- Dates must be in `YYYY-MM-DD` format
- Invalid date formats will return a 500 error with `INVALID_DATE_FORMAT`
- If only `startDate` is provided, data from that date onwards is included
- If only `endDate` is provided, data up to that date is included
- If both are provided, data within the date range is included

## Frontend Integration Notes

1. **Always include `tenantId`** in query parameters for all requests
2. **Handle date validation errors** by checking for `INVALID_DATE_FORMAT` error code
3. **Check for item existence** by handling `MISSING_ITEM_ID` errors
4. **Implement loading states** as some analytics may take time to compute
5. **Cache results appropriately** as analytics data may not change frequently
6. **Format numbers and dates** according to user locale preferences
7. **Handle empty data arrays** gracefully (e.g., no orders in date range)

## Example Frontend Usage

```javascript
// Get item summary
const response = await fetch('/api/v1/inventory/analytics/items/ITEM001/summary?tenantId=1&startDate=2025-01-01&endDate=2025-12-31');
const data = await response.json();

if (data.success) {
  console.log('Item Summary:', data.data);
} else {
  console.error('Error:', data.error.message);
}
```