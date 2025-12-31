# Commission Payments API Documentation

## Overview
The Commission Payments API provides comprehensive management for commission tracking and payments for clinician and organization services in a modular structure. Commission payments are tracked separately from individual payment transactions, allowing for detailed payment history and installment tracking.

## Database Structure

### Commission Payments Table
- **commission_payments**: Main table tracking commission amounts due for each service
  - One record per service (serviceid is unique)
  - Tracks total commission due and total amount paid
  - Status automatically managed based on payment completion

### Commission Payment Transactions Table
- **commission_payment_transactions**: Individual payment installments
  - Multiple transactions can exist per commission payment
  - Tracks each payment amount, method, and details
  - Maintains payment history and audit trail

## Base URL
```
/api/v1/commission-payments
```

## Authentication
All endpoints require proper tenant authentication via the `tenantId` query parameter.

---

## 1. Create Commission Payment
**POST** `/api/v1/commission-payments/`

### Request
**Query Parameters:**
- `tenantId` (integer, required): Tenant identifier

**Body:**
```json
{
  "serviceid": 123,
  "commission_due": 150.00,
  "amount_paid": 0.00,
  "type": "clinician",
  "trackid": 456,
  "paymentmode": 1,
  "paid_by": 789
}
```

**Field Requirements:**
- `serviceid` (integer, required): Reference to dboservices.serviceid
- `commission_due` (decimal, required): Amount due for commission
- `type` (string, required): Either "clinician" or "organization"
- `amount_paid` (decimal, optional): Amount already paid (default: null)
- `trackid` (integer, optional): Test panel tracking ID
- `paymentmode` (integer, optional): Payment mode reference
- `paid_by` (integer, optional): Employee ID who made the payment

**Validation Rules:**
- System checks for existing payments for the same `serviceid`
- If existing payments exist, the sum of all `amount_paid` values cannot exceed `commission_due`
- New payment amounts are validated against the remaining balance
- Status is automatically set to `"paid"` if `amount_paid >= commission_due`, otherwise `"pending"`

### Response
**Success (201):**
```json
{
  "status": true,
  "message": "Commission payment created successfully",
  "data": {
    "paymentId": 1
  }
}
```

**Error (400/500):**
```json
{
  "status": false,
  "message": "Error message"
}
```

---

## 2. Get Commission Payment by ID
**GET** `/api/v1/commission-payments/:id`

### Request
**Query Parameters:**
- `tenantId` (integer, required): Tenant identifier

**Path Parameters:**
- `id` (integer, required): Commission payment ID

### Response
**Success (200):**
```json
{
  "status": true,
  "message": "Commission payment retrieved successfully",
  "data": {
    "id": 1,
    "serviceid": 123,
    "commission_due": 150.00,
    "total_amount_paid": 0.00,
    "type": "clinician",
    "status": "pending",
    "created_at": "2025-11-25T10:00:00.000Z",
    "updated_at": "2025-11-25T10:00:00.000Z"
  }
}
```

---

## 3. Get Commission Payments by Service
**GET** `/api/v1/commission-payments/service/:serviceId`

### Request
**Query Parameters:**
- `tenantId` (integer, required): Tenant identifier

**Path Parameters:**
- `serviceId` (integer, required): Service ID from dboservices

### Response
**Success (200):**
```json
{
  "status": true,
  "message": "Commission payments retrieved successfully",
  "data": [
    {
      "id": 1,
      "serviceid": 123,
      "commission_due": 150.00,
      "total_amount_paid": 150.00,
      "type": "clinician",
      "status": "paid",
      "created_at": "2025-11-25T10:00:00.000Z",
      "updated_at": "2025-11-25T10:00:00.000Z",
      "transactions": [
        {
          "id": 1,
          "commission_payment_id": 1,
          "amount_paid": 75.00,
          "trackid": 456,
          "paymentmode": 1,
          "paid_by": 789,
          "notes": "First installment",
          "created_at": "2025-11-25T10:00:00.000Z"
        },
        {
          "id": 2,
          "commission_payment_id": 1,
          "amount_paid": 75.00,
          "trackid": 456,
          "paymentmode": 1,
          "paid_by": 789,
          "notes": "Final payment",
          "created_at": "2025-11-25T11:00:00.000Z"
        }
      ]
    }
  ]
}
```

---

## 4. Get Commission Payments by Type
**GET** `/api/v1/commission-payments/type/:type`

### Request
**Query Parameters:**
- `tenantId` (integer, required): Tenant identifier
- `limit` (integer, optional): Maximum number of results

**Path Parameters:**
- `type` (string, required): Either "clinician" or "organization"

### Response
**Success (200):**
```json
{
  "status": true,
  "message": "Commission payments retrieved successfully",
  "data": [
    {
      "id": 1,
      "serviceid": 123,
      "commission_due": 150.00,
      "type": "clinician",
      "status": "pending",
      "created_at": "2025-11-25T10:00:00.000Z"
    }
  ]
}
```

---

## 5. Update Commission Payment
**PUT** `/api/v1/commission-payments/:id`

### Request
**Query Parameters:**
- `tenantId` (integer, required): Tenant identifier

**Path Parameters:**
- `id` (integer, required): Commission payment ID

**Body:** (any combination of updatable fields)
```json
{
  "commission_due": 175.00,
  "amount_paid": 50.00,
  "paymentmode": 2,
  "paid_by": 790
}
```

**Note:** `id`, `serviceid`, `type`, `created_at` fields cannot be updated.

### Response
**Success (200):**
```json
{
  "status": true,
  "message": "Commission payment updated successfully"
}
```

---

## 6. Update Payment Amount
**PATCH** `/api/v1/commission-payments/:id/amount`

### Request
**Query Parameters:**
- `tenantId` (integer, required): Tenant identifier

**Path Parameters:**
- `id` (integer, required): Commission payment ID

**Body:**
```json
{
  "amount_paid": 150.00
}
```

### Response
**Success (200):**
```json
{
  "status": true,
  "message": "Payment amount updated successfully"
}
```

---

## 7. Update Commission Payment Status
**PATCH** `/api/v1/commission-payments/:id/status`

### Request
**Query Parameters:**
- `tenantId` (integer, required): Tenant identifier

**Path Parameters:**
- `id` (integer, required): Commission payment ID

**Body:**
```json
{
  "status": "paid"
}
```

**Valid Status Values:**
- `"pending"` - Commission due but not yet paid
- `"paid"` - Commission has been fully paid
- `"overdue"` - Commission payment is past due
- `"cancelled"` - Commission payment cancelled

### Response
**Success (200):**
```json
{
  "status": true,
  "message": "Commission payment status updated successfully"
}
```

---

## 8. Get Commission Payments by Status
**GET** `/api/v1/commission-payments/status/:status`

### Request
**Query Parameters:**
- `tenantId` (integer, required): Tenant identifier
- `limit` (integer, optional): Maximum number of results

**Path Parameters:**
- `status` (string, required): Status value ("pending", "paid", "overdue", "cancelled")

### Response
**Success (200):**
```json
{
  "status": true,
  "message": "Commission payments retrieved successfully",
  "data": [
    {
      "id": 1,
      "serviceid": 123,
      "commission_due": 150.00,
      "amount_paid": 0.00,
      "type": "clinician",
      "status": "pending",
      "created_at": "2025-11-25T10:00:00.000Z"
    }
  ]
}
```

---

## 9. Get Commission Payment Summary
**GET** `/api/v1/commission-payments/summary/overview`

### Request
**Query Parameters:**
- `tenantId` (integer, required): Tenant identifier
- `type` (string, optional): Filter by "clinician" or "organization"

### Response
**Success (200):**
```json
{
  "status": true,
  "message": "Commission payment summary retrieved successfully",
  "data": {
    "total_commission_due": 2500.00,
    "total_amount_paid": 1500.00,
    "total_outstanding": 1000.00,
    "payment_count": 15
  }
}
```

---

## 10. Get Unpaid Commission Payments
**GET** `/api/v1/commission-payments/unpaid/list`

### Request
**Query Parameters:**
- `tenantId` (integer, required): Tenant identifier
- `type` (string, optional): Filter by "clinician" or "organization"

### Response
**Success (200):**
```json
{
  "status": true,
  "message": "Unpaid commission payments retrieved successfully",
  "data": [
    {
      "id": 1,
      "serviceid": 123,
      "commission_due": 150.00,
      "amount_paid": 0.00,
      "type": "clinician",
      "status": "pending",
      "created_at": "2025-11-25T10:00:00.000Z"
    }
  ]
}
```

---

## 11. Get Commission Payments with Details
**GET** `/api/v1/commission-payments/detailed/list`

### Request
**Query Parameters:**
- `tenantId` (integer, required): Tenant identifier
- `limit` (integer, optional): Maximum number of results

### Response
**Success (200):**
```json
{
  "status": true,
  "message": "Commission payments with details retrieved successfully",
  "data": [
    {
      "id": 1,
      "serviceid": 123,
      "commission_due": 150.00,
      "amount_paid": 0.00,
      "type": "clinician",
      "status": "pending",
      "serviceCategory": "CLINICIAN_SPECIAL_BILLING",
      "totalpayable": 1000.00,
      "status": "active",
      "test_name": "Complete Blood Count",
      "created_at": "2025-11-25T10:00:00.000Z"
    }
  ]
}
```

---

## 12. Delete Commission Payment
**DELETE** `/api/v1/commission-payments/:id`

### Request
**Query Parameters:**
- `tenantId` (integer, required): Tenant identifier

**Path Parameters:**
- `id` (integer, required): Commission payment ID

### Response
**Success (200):**
```json
{
  "status": true,
  "message": "Commission payment deleted successfully"
}
```

---

## Error Responses

## 13. Get Commission Payment Transactions
**GET** `/api/v1/commission-payments/:commissionPaymentId/transactions`

### Request
**Query Parameters:**
- `tenantId` (integer, required): Tenant identifier

**Path Parameters:**
- `commissionPaymentId` (integer, required): Commission payment ID

### Response
**Success (200):**
```json
{
  "status": true,
  "message": "Commission payment transactions retrieved successfully",
  "data": [
    {
      "id": 1,
      "commission_payment_id": 1,
      "amount_paid": 50.00,
      "trackid": 456,
      "paymentmode": 1,
      "paid_by": 789,
      "notes": "Partial payment",
      "created_at": "2025-11-25T10:00:00.000Z"
    }
  ]
}
```

---

## 14. Create Commission Payment Transaction
**POST** `/api/v1/commission-payments/transactions`

### Request
**Query Parameters:**
- `tenantId` (integer, required): Tenant identifier

**Body:**
```json
{
  "commission_payment_id": 1,
  "amount_paid": 50.00,
  "trackid": 456,
  "paymentmode": 1,
  "paid_by": 789,
  "notes": "Partial payment installment"
}
```

**Field Requirements:**
- `commission_payment_id` (integer, required): Reference to commission_payments.id
- `amount_paid` (decimal, required): Amount being paid in this transaction
- `trackid` (integer, optional): Test panel tracking ID
- `paymentmode` (integer, optional): Payment mode reference
- `paid_by` (integer, optional): Employee ID who made the payment
- `notes` (string, optional): Additional notes for the transaction

### Response
**Success (201):**
```json
{
  "status": true,
  "message": "Commission payment transaction created successfully",
  "data": {
    "transactionId": 1
  }
}
```

---

## 15. Delete Commission Payment Transaction
**DELETE** `/api/v1/commission-payments/transactions/:id`

### Request
**Query Parameters:**
- `tenantId` (integer, required): Tenant identifier

**Path Parameters:**
- `id` (integer, required): Transaction ID

### Response
**Success (200):**
```json
{
  "status": true,
  "message": "Commission payment transaction deleted successfully"
}
```

---

## Error Responses

All endpoints return errors in the following format:

```json
{
  "status": false,
  "message": "Error description"
}
```

### Common HTTP Status Codes:
- `400` - Bad Request (validation errors)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error (system errors)

### Common Error Messages:
- `"serviceid, commission_due, and type are required"`
- `"type must be either 'clinician' or 'organization'"`
- `"Valid payment ID is required"`
- `"Commission payment not found"`
- `"Valid status is required (pending, paid, overdue, cancelled)"`
- `"Payment amount exceeds commission due. Total paid would be [amount], but commission due is [amount]"`

---

## Data Types

### CommissionPayment Object
```typescript
interface CommissionPayment {
  id?: number;
  serviceid: number;
  commission_due: number;
  total_amount_paid: number;
  type: 'clinician' | 'organization';
  status?: 'pending' | 'paid' | 'overdue' | 'cancelled';
  created_at?: Date;
  updated_at?: Date;
}
```

### CommissionPaymentTransaction Object
```typescript
interface CommissionPaymentTransaction {
  id?: number;
  commission_payment_id: number;
  amount_paid: number;
  trackid?: number;
  paymentmode?: number;
  paid_by?: number;
  notes?: string;
  created_at?: Date;
}
```

### CommissionPaymentSummary Object
```typescript
interface CommissionPaymentSummary {
  total_commission_due: number;
  total_amount_paid: number;
  total_outstanding: number;
  payment_count: number;
}
```

---

## Notes

1. **Tenant Isolation**: All operations are scoped to the provided `tenantId`
2. **Foreign Keys**: `serviceid` references `dboservices.serviceid`
3. **Default Status**: New commission payments default to `"pending"` status
4. **Automatic Status Updates**: Status is automatically updated to `"paid"` when `amount_paid >= commission_due`, otherwise remains `"pending"`
5. **Immutable Fields**: `id`, `serviceid`, `type`, and `created_at` cannot be modified
6. **Cascade Delete**: Deleting a service from `dboservices` will cascade delete related commission payments