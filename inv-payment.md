# Supplier Payment API Documentation

## Overview
The Supplier Payment API provides endpoints for managing supplier payments, allocations, and related financial operations in the inventory system.

## Base URL
```
/api/v1/inventory/supplier-payments/
```

---

# 🎨 Frontend Implementation Guide

## Required Pages & Components

### 1. **Payment List/Dashboard Page**
**Route:** `/payments` or `/supplier-payments`

**Purpose:** Main payment management interface

**Required Components:**
- **Data Table** with columns:
  - Payment ID (clickable link to detail)
  - Supplier Name
  - Purchase Order (clickable)
  - Amount (formatted currency)
  - Status (colored badges)
  - Payment Date
  - Method
  - Actions (View, Edit, Approve, Cancel)

- **Filters Panel:**
  - Supplier dropdown (autocomplete)
  - Status multi-select
  - Date range picker
  - Payment method select
  - Search input

- **Action Buttons:**
  - "Create New Payment" (primary button)
  - "Export" (secondary)
  - "Bulk Actions" (approve/cancel multiple)

**Data Loading:**
```javascript
// Initial load
const loadPayments = async (filters = {}) => {
  const query = new URLSearchParams({
    page: 1,
    limit: 20,
    ...filters
  });
  const response = await fetch(`/api/v1/inventory/supplier-payments/payments?${query}`);
  const data = await response.json();
  setPayments(data.data.payments);
  setPagination(data.data.pagination);
};
```

### 2. **Create Payment Form**
**Route:** `/payments/create`

**Form Fields:**
```javascript
const paymentForm = {
  supplier_id: '', // Required - Supplier dropdown with search
  purchase_order_id: '', // Required - PO dropdown filtered by supplier
  payment_amount: 0, // Required - Number input with currency formatting
  payment_date: new Date().toISOString().split('T')[0], // Date picker
  payment_method: 'bank_transfer', // Select dropdown
  reference_number: '', // Optional text input
  payment_notes: '' // Optional textarea
};
```

**Validation Rules:**
- `supplier_id`: Required, must exist
- `purchase_order_id`: Required, must belong to selected supplier
- `payment_amount`: Required, > 0, ≤ PO total amount
- `payment_date`: Required, not future date
- `payment_method`: Required, from predefined list

**UI Components Needed:**
- Supplier autocomplete dropdown
- Purchase order dropdown (filtered by supplier)
- Currency input with formatting
- Date picker
- Method select with icons
- Form validation with error messages

### 3. **Payment Detail View**
**Route:** `/payments/:id`

**Sections:**
1. **Payment Header Card:**
   - Payment ID, Status badge, Amount
   - Supplier info, PO link
   - Created/Approved dates

2. **Payment Details:**
   - All payment fields (read-only)
   - Status timeline/history

3. **Allocations Table:**
   - Item details, allocated amounts
   - Add/Edit allocation buttons

4. **Action Buttons:**
   - Edit (if pending)
   - Approve (if pending)
   - Cancel (if pending/approved)
   - Add Allocation

### 4. **Edit Payment Form**
**Route:** `/payments/:id/edit`

**Similar to Create Form but:**
- Pre-populated with existing data
- Only editable when status is "pending"
- Different validation (can reduce amount but not exceed allocations)

### 5. **Allocation Management**
**Components:**
- **Add Allocation Modal/Dialog:**
  ```javascript
  const allocationForm = {
    purchase_order_id: '', // Auto-filled from payment
    order_item_id: '', // Dropdown of PO items
    allocated_amount: 0, // Number input
    allocation_notes: '' // Textarea
  };
  ```

- **Allocation List:**
  - Table showing all allocations for payment
  - Edit/Delete actions per row

### 6. **Payment Summary/Dashboard**
**Route:** `/payments/summary`

**Charts & Metrics:**
- Total payments count/amount
- Status breakdown (pie chart)
- Monthly trends (line chart)
- Top suppliers (bar chart)
- Payment methods distribution

---

## Endpoints

### 1. Create Payment
**POST** `/payments`

Creates a new supplier payment record with pending status.

**Request Body:**
```json
{
  "supplier_id": "SUP-001",
  "purchase_order_id": "PO-123",
  "payment_amount": 500.00,
  "payment_date": "2025-11-13",
  "payment_method": "bank_transfer",
  "reference_number": "CHK-12345",
  "payment_notes": "Payment for lab supplies"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "PAY-1763065498436",
    "supplier_id": "SUP-001",
    "purchase_order_id": "PO-123",
    "payment_amount": 500.00,
    "total_allocated": 0.00,
    "payment_date": "2025-11-13",
    "payment_method": "bank_transfer",
    "payment_status": "pending",
    "reference_number": "CHK-12345",
    "payment_notes": "Payment for lab supplies",
    "created_by": "user@example.com",
    "created_at": "2025-11-13T12:00:00Z",
    "updated_at": "2025-11-13T12:00:00Z"
  }
}
```

### 2. Get Payment by ID
**GET** `/payments/:id`

Retrieves a specific payment by its internal ID.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "PAY-1763065498436",
    "supplier_id": "SUP-001",
    "purchase_order_id": "PO-123",
    "payment_amount": 500.00,
    "total_allocated": 250.00,
    "payment_date": "2025-11-13",
    "payment_method": "bank_transfer",
    "payment_status": "approved",
    "reference_number": "CHK-12345",
    "payment_notes": "Payment for lab supplies",
    "created_by": "user@example.com",
    "approved_by": "manager@example.com",
    "approved_at": "2025-11-13T14:30:00Z",
    "created_at": "2025-11-13T12:00:00Z",
    "updated_at": "2025-11-13T14:30:00Z",
    "allocations": [
      {
        "id": "ALLOC-1763065498437",
        "payment_id": "PAY-1763065498436",
        "purchase_order_id": "PO-123",
        "order_item_id": "POI-456",
        "allocated_amount": 250.00,
        "allocation_notes": "Partial payment for blood tubes",
        "created_at": "2025-11-13T13:00:00Z"
      }
    ]
  }
}
```

### 3. Get Payment by Payment ID
**GET** `/payments/by-payment-id/:paymentId`

Retrieves a payment by its payment reference number.

**Response:** Same as Get Payment by ID

### 4. List Payments
**GET** `/payments`

Retrieves a list of payments with optional filtering.

**Query Parameters:**
- `supplier_id` - Filter by supplier
- `purchase_order_id` - Filter by purchase order
- `payment_status` - Filter by status (pending, approved, completed, failed, cancelled, refunded)
- `payment_method` - Filter by payment method
- `start_date` - Filter payments from this date
- `end_date` - Filter payments to this date
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)

**Example:** `/payments?supplier_id=SUP-001&payment_status=approved&page=1&limit=10`

**Response:**
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "id": "PAY-1763065498436",
        "supplier_id": "SUP-001",
        "purchase_order_id": "PO-123",
        "payment_amount": 500.00,
        "total_allocated": 500.00,
        "payment_date": "2025-11-13",
        "payment_method": "bank_transfer",
        "payment_status": "approved",
        "reference_number": "CHK-12345",
        "approved_by": "manager@example.com",
        "approved_at": "2025-11-13T14:30:00Z",
        "created_at": "2025-11-13T12:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "total_pages": 3
    }
  }
}
```

### 5. Update Payment
**PUT** `/payments/:id`

Updates an existing payment (only allowed for pending payments).

**Request Body:**
```json
{
  "payment_amount": 600.00,
  "payment_date": "2025-11-14",
  "payment_method": "check",
  "reference_number": "CHK-12346",
  "payment_notes": "Updated payment amount"
}
```

**Response:** Same as Create Payment

### 6. Approve Payment
**PUT** `/payments/:id/approve`

Approves a pending payment and creates accounting journal entries.

**Request Body:** Empty (approval is automatic)

**Response:**
```json
{
  "success": true,
  "message": "Payment approved successfully",
  "data": {
    "id": "PAY-1763065498436",
    "payment_status": "approved",
    "approved_by": "manager@example.com",
    "approved_at": "2025-11-13T14:30:00Z",
    "updated_at": "2025-11-13T14:30:00Z"
  }
}
```

### 7. Cancel Payment
**PUT** `/payments/:id/cancel`

Cancels a pending or approved payment.

**Request Body:** Empty

**Response:**
```json
{
  "success": true,
  "message": "Payment cancelled successfully",
  "data": {
    "id": "PAY-1763065498436",
    "payment_status": "cancelled",
    "updated_at": "2025-11-13T15:00:00Z"
  }
}
```

### 8. Add Allocation
**POST** `/payments/:id/allocations`

Adds an allocation to link payment to specific purchase order items.

**Request Body:**
```json
{
  "purchase_order_id": "PO-123",
  "order_item_id": "POI-456",
  "allocated_amount": 250.00,
  "allocation_notes": "Payment for blood collection tubes"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Allocation added successfully",
  "data": {
    "id": "ALLOC-1763065498437",
    "payment_id": "PAY-1763065498436",
    "purchase_order_id": "PO-123",
    "order_item_id": "POI-456",
    "allocated_amount": 250.00,
    "allocation_notes": "Payment for blood collection tubes",
    "created_at": "2025-11-13T13:00:00Z"
  }
}
```

### 9. Remove Allocation
**DELETE** `/allocations/:allocationId`

Removes an allocation from a payment.

**Response:**
```json
{
  "success": true,
  "message": "Allocation removed successfully"
}
```

### 10. Get Payment Summary
**GET** `/payments/summary`

Retrieves payment statistics and summaries.

**Query Parameters:**
- `start_date` - Start date for summary
- `end_date` - End date for summary
- `supplier_id` - Filter by specific supplier

**Response:**
```json
{
  "success": true,
  "data": {
    "total_payments": 150,
    "total_amount": 75000.00,
    "approved_payments": 145,
    "approved_amount": 72500.00,
    "pending_payments": 5,
    "pending_amount": 2500.00,
    "by_status": {
      "pending": { "count": 5, "amount": 2500.00 },
      "approved": { "count": 145, "amount": 72500.00 },
      "completed": { "count": 140, "amount": 70000.00 },
      "cancelled": { "count": 3, "amount": 1500.00 },
      "failed": { "count": 2, "amount": 1000.00 }
    },
    "by_method": {
      "bank_transfer": { "count": 100, "amount": 50000.00 },
      "check": { "count": 35, "amount": 17500.00 },
      "cash": { "count": 10, "amount": 5000.00 },
      "credit_card": { "count": 5, "amount": 2500.00 }
    },
    "by_supplier": [
      {
        "supplier_id": "SUP-001",
        "supplier_name": "Lab Supplies Inc",
        "total_payments": 45,
        "total_amount": 22500.00
      }
    ]
  }
}
```

---

## 🎯 Frontend Development Requirements

### State Management
```javascript
// Global state structure
const paymentState = {
  payments: [],
  currentPayment: null,
  filters: {
    supplier_id: '',
    status: [],
    dateRange: { start: null, end: null },
    page: 1,
    limit: 20
  },
  loading: false,
  error: null,
  summary: null
};
```

### Form Validation Rules
```javascript
const validationRules = {
  supplier_id: { required: true, message: 'Supplier is required' },
  purchase_order_id: { required: true, message: 'Purchase order is required' },
  payment_amount: {
    required: true,
    min: 0.01,
    message: 'Amount must be greater than 0'
  },
  payment_date: {
    required: true,
    max: new Date(),
    message: 'Payment date cannot be in the future'
  }
};
```

### UI Components Needed

#### **Status Badges**
```javascript
const statusConfig = {
  pending: { color: 'yellow', label: 'Pending Approval' },
  approved: { color: 'blue', label: 'Approved' },
  completed: { color: 'green', label: 'Completed' },
  cancelled: { color: 'red', label: 'Cancelled' },
  failed: { color: 'red', label: 'Failed' },
  refunded: { color: 'orange', label: 'Refunded' }
};
```

#### **Action Buttons Configuration**
```javascript
const getPaymentActions = (payment) => {
  const actions = [];

  if (payment.payment_status === 'pending') {
    actions.push(
      { label: 'Edit', action: 'edit', variant: 'secondary' },
      { label: 'Approve', action: 'approve', variant: 'primary' },
      { label: 'Cancel', action: 'cancel', variant: 'danger' }
    );
  }

  actions.push({ label: 'View Details', action: 'view', variant: 'outline' });

  return actions;
};
```

### Error Handling UI
```javascript
const handleApiError = (error) => {
  switch(error.code) {
    case 'VALIDATION_ERROR':
      showFormErrors(error.details);
      break;
    case 'NOT_FOUND':
      showToast('Payment not found', 'error');
      navigate('/payments');
      break;
    case 'INVALID_STATUS':
      showToast('Operation not allowed for current payment status', 'warning');
      break;
    default:
      showToast('An unexpected error occurred', 'error');
  }
};
```

### Navigation Flow
```
Dashboard → Payment List → [Create Payment | View Payment]
                     ↓
              Edit Payment ← Approve/Cancel
                     ↓
               Allocation Management
```

### Data Refresh Strategy
```javascript
// Auto-refresh after actions
const refreshData = async () => {
  await Promise.all([
    loadPayments(currentFilters),
    loadPaymentSummary()
  ]);
};

// Refresh after: Create, Update, Approve, Cancel, Add/Remove Allocation
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Payment amount must be greater than 0"
  }
}
```

## Common Error Codes
- `VALIDATION_ERROR` - Invalid request data
- `NOT_FOUND` - Payment or allocation not found
- `UNAUTHORIZED` - Insufficient permissions
- `INVALID_STATUS` - Operation not allowed for current payment status
- `DATABASE_ERROR` - Database operation failed

## Authentication
All endpoints require authentication. Include the authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Rate Limiting
API requests are limited to 100 requests per minute per user.

### 1. Create Payment
**POST** `/payments`

Creates a new supplier payment record with pending status.

**Request Body:**
```json
{
  "supplier_id": "SUP-001",
  "purchase_order_id": "PO-123",
  "payment_amount": 500.00,
  "payment_date": "2025-11-13",
  "payment_method": "bank_transfer",
  "reference_number": "CHK-12345",
  "payment_notes": "Payment for lab supplies"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "PAY-1763065498436",
    "supplier_id": "SUP-001",
    "purchase_order_id": "PO-123",
    "payment_amount": 500.00,
    "total_allocated": 0.00,
    "payment_date": "2025-11-13",
    "payment_method": "bank_transfer",
    "payment_status": "pending",
    "reference_number": "CHK-12345",
    "payment_notes": "Payment for lab supplies",
    "created_by": "user@example.com",
    "created_at": "2025-11-13T12:00:00Z",
    "updated_at": "2025-11-13T12:00:00Z"
  }
}
```

### 2. Get Payment by ID
**GET** `/payments/:id`

Retrieves a specific payment by its internal ID.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "PAY-1763065498436",
    "supplier_id": "SUP-001",
    "purchase_order_id": "PO-123",
    "payment_amount": 500.00,
    "total_allocated": 250.00,
    "payment_date": "2025-11-13",
    "payment_method": "bank_transfer",
    "payment_status": "approved",
    "reference_number": "CHK-12345",
    "payment_notes": "Payment for lab supplies",
    "created_by": "user@example.com",
    "approved_by": "manager@example.com",
    "approved_at": "2025-11-13T14:30:00Z",
    "created_at": "2025-11-13T12:00:00Z",
    "updated_at": "2025-11-13T14:30:00Z",
    "allocations": [
      {
        "id": "ALLOC-1763065498437",
        "payment_id": "PAY-1763065498436",
        "purchase_order_id": "PO-123",
        "order_item_id": "POI-456",
        "allocated_amount": 250.00,
        "allocation_notes": "Partial payment for blood tubes",
        "created_at": "2025-11-13T13:00:00Z"
      }
    ]
  }
}
```

### 3. Get Payment by Payment ID
**GET** `/payments/by-payment-id/:paymentId`

Retrieves a payment by its payment reference number.

**Response:** Same as Get Payment by ID

### 4. List Payments
**GET** `/payments`

Retrieves a list of payments with optional filtering.

**Query Parameters:**
- `supplier_id` - Filter by supplier
- `purchase_order_id` - Filter by purchase order
- `payment_status` - Filter by status (pending, approved, completed, failed, cancelled, refunded)
- `payment_method` - Filter by payment method
- `start_date` - Filter payments from this date
- `end_date` - Filter payments to this date
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)

**Example:** `/payments?supplier_id=SUP-001&payment_status=approved&page=1&limit=10`

**Response:**
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "id": "PAY-1763065498436",
        "supplier_id": "SUP-001",
        "purchase_order_id": "PO-123",
        "payment_amount": 500.00,
        "total_allocated": 500.00,
        "payment_date": "2025-11-13",
        "payment_method": "bank_transfer",
        "payment_status": "approved",
        "reference_number": "CHK-12345",
        "approved_by": "manager@example.com",
        "approved_at": "2025-11-13T14:30:00Z",
        "created_at": "2025-11-13T12:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "total_pages": 3
    }
  }
}
```

### 5. Update Payment
**PUT** `/payments/:id`

Updates an existing payment (only allowed for pending payments).

**Request Body:**
```json
{
  "payment_amount": 600.00,
  "payment_date": "2025-11-14",
  "payment_method": "check",
  "reference_number": "CHK-12346",
  "payment_notes": "Updated payment amount"
}
```

**Response:** Same as Create Payment

### 6. Approve Payment
**PUT** `/payments/:id/approve`

Approves a pending payment and creates accounting journal entries.

**Request Body:** Empty (approval is automatic)

**Response:**
```json
{
  "success": true,
  "message": "Payment approved successfully",
  "data": {
    "id": "PAY-1763065498436",
    "payment_status": "approved",
    "approved_by": "manager@example.com",
    "approved_at": "2025-11-13T14:30:00Z",
    "updated_at": "2025-11-13T14:30:00Z"
  }
}
```

### 7. Cancel Payment
**PUT** `/payments/:id/cancel`

Cancels a pending or approved payment.

**Request Body:** Empty

**Response:**
```json
{
  "success": true,
  "message": "Payment cancelled successfully",
  "data": {
    "id": "PAY-1763065498436",
    "payment_status": "cancelled",
    "updated_at": "2025-11-13T15:00:00Z"
  }
}
```

### 8. Add Allocation
**POST** `/payments/:id/allocations`

Adds an allocation to link payment to specific purchase order items.

**Request Body:**
```json
{
  "purchase_order_id": "PO-123",
  "order_item_id": "POI-456",
  "allocated_amount": 250.00,
  "allocation_notes": "Payment for blood collection tubes"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Allocation added successfully",
  "data": {
    "id": "ALLOC-1763065498437",
    "payment_id": "PAY-1763065498436",
    "purchase_order_id": "PO-123",
    "order_item_id": "POI-456",
    "allocated_amount": 250.00,
    "allocation_notes": "Payment for blood collection tubes",
    "created_at": "2025-11-13T13:00:00Z"
  }
}
```

### 9. Remove Allocation
**DELETE** `/allocations/:allocationId`

Removes an allocation from a payment.

**Response:**
```json
{
  "success": true,
  "message": "Allocation removed successfully"
}
```

### 10. Get Payment Summary
**GET** `/payments/summary`

Retrieves payment statistics and summaries.

**Query Parameters:**
- `start_date` - Start date for summary
- `end_date` - End date for summary
- `supplier_id` - Filter by specific supplier

**Response:**
```json
{
  "success": true,
  "data": {
    "total_payments": 150,
    "total_amount": 75000.00,
    "approved_payments": 145,
    "approved_amount": 72500.00,
    "pending_payments": 5,
    "pending_amount": 2500.00,
    "by_status": {
      "pending": { "count": 5, "amount": 2500.00 },
      "approved": { "count": 145, "amount": 72500.00 },
      "completed": { "count": 140, "amount": 70000.00 },
      "cancelled": { "count": 3, "amount": 1500.00 },
      "failed": { "count": 2, "amount": 1000.00 }
    },
    "by_method": {
      "bank_transfer": { "count": 100, "amount": 50000.00 },
      "check": { "count": 35, "amount": 17500.00 },
      "cash": { "count": 10, "amount": 5000.00 },
      "credit_card": { "count": 5, "amount": 2500.00 }
    },
    "by_supplier": [
      {
        "supplier_id": "SUP-001",
        "supplier_name": "Lab Supplies Inc",
        "total_payments": 45,
        "total_amount": 22500.00
      }
    ]
  }
}
```

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Payment amount must be greater than 0"
  }
}
```

## Common Error Codes
- `VALIDATION_ERROR` - Invalid request data
- `NOT_FOUND` - Payment or allocation not found
- `UNAUTHORIZED` - Insufficient permissions
- `INVALID_STATUS` - Operation not allowed for current payment status
- `DATABASE_ERROR` - Database operation failed

## Authentication
All endpoints require authentication. Include the authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Rate Limiting
API requests are limited to 100 requests per minute per user.