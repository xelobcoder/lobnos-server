# Commission Analytics Documentation

## Overview

The Commission Analytics system provides comprehensive reporting and analysis of **paid commissions** across time periods and recipients. It focuses on tracking what has been **paid out**, not what is due.

## Key Concepts

### What Gets Tracked

Analytics queries the `commission_batch_payments` table to analyze:

- **Payments Made**: `payment_amount` - What was actually paid
- **Amounts Waived**: `waived_amount` - Waived portions
- **Due vs Paid**: Comparison between `total_commission_amount` and `payment_amount`
- **Payment Status**: Pending, Completed, or Cancelled
- **Recipients**: Clinicians and Organizations
- **Time Periods**: Daily, Weekly, Monthly, Quarterly, Yearly

## Time Period Breakdowns

The system supports 5 time period types for analytics:

| Period      | Format     | Example    |
| ----------- | ---------- | ---------- |
| `daily`     | YYYY-MM-DD | 2024-05-15 |
| `weekly`    | YYYY-W##   | 2024-W20   |
| `monthly`   | YYYY-MM    | 2024-05    |
| `quarterly` | Q#-YYYY    | Q2-2024    |
| `yearly`    | YYYY       | 2024       |

## API Endpoints

### 1. Get Comprehensive Dashboard

**Endpoint**: `GET /api/v1/commission/analytics/dashboard`

Combines period, status, and efficiency data for a complete overview.

**Query Parameters**:

- `tenantId` (required): Tenant identifier
- `startDate` (required): Start date (ISO format)
- `endDate` (required): End date (ISO format)
- `period` (optional): daily|weekly|monthly|quarterly|yearly (default: monthly)
- `recipientType` (optional): clinician|organization
- `recipientId` (optional): Specific recipient ID
- `status` (optional): pending|completed|cancelled

**Response Example**:

```json
{
  "status": "success",
  "result": {
    "summary": {
      "totalPaid": 50000.0,
      "totalDue": 55000.0,
      "totalWaived": 2000.0,
      "averagePaid": 5000.0,
      "batchCount": 10,
      "uniqueRecipients": 5,
      "paymentPercentage": 90.91,
      "period": "2024-01-01 to 2024-05-09"
    },
    "byPeriod": {
      "period": "monthly",
      "data": [
        {
          "period": "2024-01",
          "period_start": "2024-01-01",
          "period_end": "2024-01-31",
          "total_paid": 10000.0,
          "average_paid": 2000.0,
          "total_waived": 500.0,
          "batch_count": 5,
          "total_due": 11000.0
        }
      ]
    },
    "byStatus": [
      {
        "status": "completed",
        "totalPaid": 50000.0,
        "count": 10,
        "averagePaid": 5000.0
      }
    ],
    "recipientEfficiency": [
      {
        "recipientId": 1,
        "recipientType": "clinician",
        "totalPaid": 25000.0,
        "totalDue": 27000.0,
        "paymentPercentage": 92.59,
        "paymentBatches": 5
      }
    ]
  }
}
```

### 2. Get Payments by Period

**Endpoint**: `GET /api/v1/commission/analytics/by-period`

Analyzes commission payments grouped by time period.

**Query Parameters**:

- `tenantId` (required)
- `startDate` (required)
- `endDate` (required)
- `period` (required): daily|weekly|monthly|quarterly|yearly
- `recipientType` (optional): clinician|organization
- `recipientId` (optional): Specific recipient ID
- `status` (optional): pending|completed|cancelled

**Use Case**: Analyze payment trends over time (e.g., how much paid each month)

### 3. Get Payments by Recipient

**Endpoint**: `GET /api/v1/commission/analytics/by-recipient`

Shows payment breakdown for each recipient across the period.

**Query Parameters**:

- `tenantId` (required)
- `startDate` (required)
- `endDate` (required)
- `period` (required)
- `recipientType` (required): clinician|organization
- `status` (optional)

**Use Case**: Compare payment amounts across all clinicians or organizations

### 4. Get Specific Recipient's Payments by Period

**Endpoint**: `GET /api/v1/commission/analytics/recipient/:recipientId`

Shows period-by-period breakdown for a specific recipient.

**Query Parameters**:

- `tenantId` (required)
- `startDate` (required)
- `endDate` (required)
- `period` (required)
- `recipientType` (required): clinician|organization
- `status` (optional)

**Use Case**: Analyze a specific clinician's payment history across periods

### 5. Get Payment Summary

**Endpoint**: `GET /api/v1/commission/analytics/summary`

High-level statistics for the entire period.

**Query Parameters**:

- `tenantId` (required)
- `startDate` (required)
- `endDate` (required)
- `recipientType` (optional)
- `recipientId` (optional)
- `status` (optional)

**Response Example**:

```json
{
  "status": "success",
  "result": {
    "totalPaid": 50000.0,
    "totalDue": 55000.0,
    "totalWaived": 2000.0,
    "averagePaid": 5000.0,
    "batchCount": 10,
    "uniqueRecipients": 5,
    "paymentPercentage": 90.91,
    "period": "2024-01-01 to 2024-05-09"
  }
}
```

### 6. Get Payments by Status

**Endpoint**: `GET /api/v1/commission/analytics/by-status`

Breakdown of payments by status (pending, completed, cancelled).

**Use Case**: See how many payments are completed vs pending

### 7. Get Payment Efficiency

**Endpoint**: `GET /api/v1/commission/analytics/efficiency`

Shows what percentage of due commissions have been paid for each recipient.

**Response Example**:

```json
{
  "status": "success",
  "result": [
    {
      "recipientId": 1,
      "recipientType": "clinician",
      "totalPaid": 25000.0,
      "totalDue": 27000.0,
      "totalWaived": 500.0,
      "paymentBatches": 5,
      "paymentPercentage": 92.59
    }
  ]
}
```

**Use Case**: Identify recipients with incomplete payments (< 100%)

## Usage Examples

### Example 1: Monthly Payment Trends

```
GET /api/v1/commission/analytics/by-period?tenantId=1&startDate=2024-01-01&endDate=2024-05-09&period=monthly
```

Returns how much was paid each month.

### Example 2: Clinician Payment History

```
GET /api/v1/commission/analytics/recipient/42?tenantId=1&startDate=2024-01-01&endDate=2024-05-09&period=monthly&recipientType=clinician
```

Shows specific clinician's payment breakdown by month.

### Example 3: Organization Payment Efficiency

```
GET /api/v1/commission/analytics/efficiency?tenantId=1&startDate=2024-01-01&endDate=2024-05-09&recipientType=organization
```

Shows all organizations and what % of their due commissions have been paid.

### Example 4: Weekly Payment Distribution

```
GET /api/v1/commission/analytics/by-recipient?tenantId=1&startDate=2024-01-01&endDate=2024-05-09&period=weekly&recipientType=clinician
```

Shows all clinicians and their payment amounts by week.

## Data Source

All analytics queries the `commission_batch_payments` table which contains:

- **batch_reference**: Unique batch identifier
- **recipient_type**: 'clinician' or 'organization'
- **recipient_id**: ID of the recipient
- **start_date / end_date**: Period covered by the batch
- **total_commission_amount**: What was due
- **payment_amount**: What was actually paid
- **waived_amount**: What was waived
- **status**: 'pending', 'completed', or 'cancelled'
- **payment_date**: When the payment was made
- **created_at / updated_at**: Timestamps

## Related Tables

- `commission_batch_payment_services`: Tracks which services were included in each batch
- `commission_payment_transactions`: Individual payment transaction details
- `commission_tracking`: Commission calculations (not used for analytics)

## Key Metrics

| Metric              | Definition                                     |
| ------------------- | ---------------------------------------------- |
| `totalPaid`         | Sum of `payment_amount` in the period          |
| `totalDue`          | Sum of `total_commission_amount` in the period |
| `totalWaived`       | Sum of `waived_amount` in the period           |
| `averagePaid`       | Average `payment_amount`                       |
| `paymentPercentage` | (totalPaid / totalDue) \* 100                  |
| `batchCount`        | Number of batches in the period                |
| `uniqueRecipients`  | Count of distinct recipients                   |

## Notes

- All monetary values are returned as DECIMAL(12,2)
- Dates are returned in ISO format
- Use `payment_date` (or `created_at` if `payment_date` is null) for analytics time grouping
- Status values: `pending`, `completed`, `cancelled`
- Recipient types: `clinician`, `organization`
