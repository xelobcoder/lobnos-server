# Commission Payments API Documentation

## Overview
The Commission Payments API provides comprehensive functionality for managing commission payments for laboratory services. It supports both clinician and organization commissions with modular payment tracking through transactions.

## Database Schema

### commission_payments
- `id` (Primary Key)
- `serviceid` (Unique, references laboratory services)
- `commission_due` (Decimal)
- `total_amount_paid` (Decimal, tracks cumulative payments)
- `type` ('clinician' or 'organization')
- `status` ('pending', 'paid', 'overdue', 'cancelled')
- `created_at`, `updated_at`

### commission_payment_transactions
- `id` (Primary Key)
- `commission_payment_id` (Foreign Key)
- `amount_paid` (Decimal)
- `trackid` (Optional tracking reference)
- `paymentmode` (Foreign Key to paymentmodes.KeyID)
- `paid_by` (Foreign Key to roles.employeeid)
- `notes` (Optional)
- `created_at`

## API Endpoints

### 1. Create Commission Payment
**POST** `/api/commission-payments`

**Request Body:**
```json
{
  "serviceid": 12345,
  "commission_due": 500.00,
  "type": "clinician"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Commission payment created successfully",
  "data": {
    "id": 1
  }
}
```

### 2. Add Payment Transaction
**POST** `/api/commission-payments/:id/transactions`

**Request Body:**
```json
{
  "amount_paid": 250.00,
  "paymentmode": 1,
  "paid_by": 123,
  "notes": "Partial payment"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment transaction added successfully",
  "data": {
    "id": 1
  }
}
```

### 3. Get Commission Payments by Service
**GET** `/api/commission-payments/service/:serviceId`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "serviceid": 12345,
      "commission_due": 500.00,
      "total_amount_paid": 250.00,
      "type": "clinician",
      "status": "pending",
      "created_at": "2025-11-25T10:00:00Z",
      "updated_at": "2025-11-25T10:00:00Z",
      "transactions": [
        {
          "id": 1,
          "commission_payment_id": 1,
          "amount_paid": 250.00,
          "trackid": null,
          "paymentmode": 1,
          "paid_by": 123,
          "paid_by_name": "john_doe",
          "payment_mode_description": "Cash",
          "notes": "Partial payment",
          "created_at": "2025-11-25T10:00:00Z"
        }
      ]
    }
  ]
}
```

### 4. Get Commission Payment Transactions
**GET** `/api/commission-payments/:id/transactions`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "commission_payment_id": 1,
      "amount_paid": 250.00,
      "trackid": null,
      "paymentmode": 1,
      "paid_by": 123,
      "paid_by_name": "john_doe",
      "payment_mode_description": "Cash",
      "notes": "Partial payment",
      "created_at": "2025-11-25T10:00:00Z"
    }
  ]
}
```

### 5. Get Commission Payments by Type
**GET** `/api/commission-payments/type/:type?limit=10`

**Parameters:**
- `type`: 'clinician' or 'organization'
- `limit`: Optional limit for results

### 6. Get Commission Payments by Status
**GET** `/api/commission-payments/status/:status?limit=10`

**Parameters:**
- `status`: 'pending', 'paid', 'overdue', 'cancelled'
- `limit`: Optional limit for results

### 7. Get Unpaid Commission Payments
**GET** `/api/commission-payments/unpaid?type=clinician`

**Parameters:**
- `type`: Optional filter by 'clinician' or 'organization'

### 8. Get Commission Payment Summary
**GET** `/api/commission-payments/summary?type=clinician`

**Response:**
```json
{
  "success": true,
  "data": {
    "total_commission_due": 2500.00,
    "total_amount_paid": 1500.00,
    "total_outstanding": 1000.00,
    "payment_count": 5
  }
}
```

### 9. Update Commission Payment Status
**PUT** `/api/commission-payments/:id/status`

**Request Body:**
```json
{
  "status": "paid"
}
```

### 10. Delete Commission Payment Transaction
**DELETE** `/api/commission-payments/transactions/:id`

## Features

### Automatic Status Management
- Status automatically updates to 'paid' when `total_amount_paid >= commission_due`
- Status reverts to 'pending' when transactions are deleted and payment becomes incomplete

### Transaction Safety
- All payment operations use database transactions to ensure data consistency
- Amount tracking is automatically maintained across transaction operations

### Validation
- Prevents overpayments through validation logic
- Ensures data integrity with foreign key constraints

### Enhanced Transaction Details
- Transactions include employee usernames from `roles` table
- Payment modes include descriptions from `paymentmodes` table
- Full audit trail with creation timestamps