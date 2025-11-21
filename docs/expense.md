# Expense Management API Documentation

## Overview
This document provides comprehensive API documentation for the expense and invoice management system. All endpoints require authentication and tenant-specific operations.

**Key Features:**
- **Bulk Operations**: Create multiple expenses and process bulk approvals in single requests
- **Transaction Safety**: All bulk operations use database transactions ensuring data consistency
- **Expense Grouping**: Related expenses automatically grouped with unique identifiers
- **Role-based Access**: Admin/Manager approval workflows with audit trails
- **Receipt Management**: Multi-file upload support for expense documentation
- **Automatic Invoice Creation**: Approved expenses automatically generate invoices for streamlined payment processing

## Authentication & Authorization
- All requests require `tenantId`, `employeeid`, and `branchid` as query parameters
- Role-based access: `admin`/`manager` have full access, others have limited access
- Expense approval workflow: Expenses must be approved before invoicing

## Base URL
All endpoints are prefixed with `/api/v1/`

---

## 1. Expense Management

### 1.1 Create Expense(s)
**Endpoint:** `POST /api/v1/expenses`

**Purpose:** Create a single expense record or multiple expense records in a single request

**Query Parameters:**
- `tenantId` (number, required): Tenant identifier
- `employeeid` (number, required): Employee creating the expense(s)
- `branchid` (number, required): Branch identifier

**Request Body (Single Expense):**
```json
{
  "name": "Office Supplies",
  "amount": 150.00,
  "employeeid": 123,
  "branchid": 456,
  "description": "Bought pens and paper",
  "merchant": 1,
  "category": 2,
  "date": "2024-01-15"
}
```

**Request Body (Bulk Expenses):**
```json
[
  {
    "name": "Office Supplies",
    "amount": 150.00,
    "employeeid": 123,
    "branchid": 456,
    "description": "Bought pens and paper",
    "merchant": 1,
    "category": 2,
    "date": "2024-01-15"
  },
  {
    "name": "Travel Expenses",
    "amount": 250.00,
    "employeeid": 123,
    "branchid": 456,
    "description": "Taxi fare to client meeting",
    "merchant": 2,
    "category": 3,
    "date": "2024-01-16"
  }
]
```

**Response (Single Expense Success):**
```json
{
  "status": 789  // Expense ID
}
```

**Response (Bulk Expenses Success):**
```json
{
  "success": [789, 790],
  "failed": [],
  "groupId": "EXP-1731950000000-0123-ABC123"  // Auto-generated group ID for bulk expenses
}
```

**Response (Bulk Expenses Partial Success):**
```json
{
  "success": [789],
  "failed": [
    {
      "data": {
        "name": "Travel Expenses",
        "amount": 250.00,
        "employeeid": 123,
        "branchid": 456,
        "description": "Taxi fare to client meeting",
        "merchant": 2,
        "category": 3,
        "date": "2024-01-16"
      },
      "error": "category id not provided"
    }
  ],
  "groupId": "EXP-1731950000000-0123-ABC123"
}
```

**Response (Error):**
```json
{
  "error": "Invalid request body. Expected expense object or array of expenses"
}
```

**Notes:**
- Send a single expense object for individual expense creation
- Send an array of expense objects for bulk creation (maximum 50 expenses)
- **Transaction Safety**: Bulk expenses are processed within a single database transaction - if any expense fails validation, the entire transaction is rolled back and no expenses are created
- Bulk expenses automatically receive a generated `groupId` for tracking related expenses
- Single expenses also receive a `groupId` (can be used for future grouping if needed)
- All bulk operations maintain data consistency through atomic transactions

---

### 1.3 Get Expenses by Group
**Endpoint:** `GET /api/v1/expenses/group/:groupId`

**Purpose:** Retrieve all expenses belonging to a specific group

**Query Parameters:**
- `tenantId` (number, required): Tenant identifier

**Response:**
```json
{
  "expenses": [
    {
      "id": 789,
      "name": "Office Supplies",
      "amount": 150.00,
      "groupId": "batch-2024-01-15-uuid",
      "approved": 0,
      "date": "2024-01-15"
    },
    {
      "id": 790,
      "name": "Travel Expenses",
      "amount": 250.00,
      "groupId": "batch-2024-01-15-uuid",
      "approved": 0,
      "date": "2024-01-16"
    }
  ]
}
```

---

### 1.3 Get Expense Records
**Endpoint:** `GET /api/v1/expenses/records`

**Purpose:** Retrieve expense records with filtering and pagination

**Query Parameters:**
- `tenantId` (number, required): Tenant identifier
- `employeeid` (number, required): Employee requesting records
- `branchid` (number, required): Branch identifier
- `count` (number, optional): Records per page (default: 10)
- `page` (number, optional): Page number (default: 1)
- `status` (string, optional): Filter by status - "approved", "rejected", "pending"
- `from` (string, optional): Start date (YYYY-MM-DD)
- `to` (string, optional): End date (YYYY-MM-DD)

**Response:**
```json
{
  "data": [
    {
      "id": 789,
      "name": "Office Supplies",
      "description": "Bought pens and paper",
      "merchant": "Office Depot",
      "approved": 1,
      "approvedby": "John Manager",
      "date": "2024-01-15",
      "createdon": "2024-01-15T10:30:00Z",
      "amount": 150.00,
      "employeeid": 123
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalRecords": 47,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

### 1.4 Get Single Expense
**Endpoint:** `GET /api/v1/expenses/record/single`

**Query Parameters:**
- `tenantId` (number, required)
- `expenseid` (number, required): Expense ID to retrieve

**Response:**
```json
{
  "id": 789,
  "name": "Office Supplies",
  "amount": 150.00,
  "images": ["receipt-789-123456789.jpg"],
  "approved": 1,
  "date": "2024-01-15"
}
```

---

### 1.5 Update Expense Record
**Endpoint:** `PUT /api/v1/expenses`

**Purpose:** Update an existing expense record

**Query Parameters:**
- `tenantId` (number, required)
- `employeeid` (number, required)
- `expenseid` (number, required): Expense to update

**Request Body:**
```json
{
  "name": "Updated Office Supplies",
  "amount": 175.00,
  "description": "Bought additional items",
  "category": 2,
  "date": "2024-01-15"
}
```

**Response:**
```json
{
  "status": true
}
```

---

### 1.6 Update Expense Decision (Approval) with Automatic Invoice Creation
**Endpoint:** `POST /api/v1/expense/pending/decision`

**Purpose:** Approve, reject, or update status of pending expenses (Admin/Manager only). Supports single and bulk operations with transaction safety. **Approved expenses automatically generate invoices.**

**Query Parameters:**
- `tenantId` (number, required)

**Request Body (Single Decision - Legacy):**
```json
{
  "expenseid": 789,
  "status": "approved",
  "information": "Approved for office supplies",
  "employeeid": 456
}
```

**Request Body (Bulk Decisions - Same Status):**
```json
{
  "status": "approved",
  "decisions": [
    {
      "expenseid": 789,
      "information": "Approved for office supplies",
      "employeeid": 456
    },
    {
      "expenseid": 790,
      "information": "Approved for travel expenses",
      "employeeid": 456
    }
  ]
}
```

**Request Body (Bulk Decisions - Mixed Statuses):**
```json
[
  {
    "expenseid": 789,
    "status": "approved",
    "information": "Approved for office supplies",
    "employeeid": 456
  },
  {
    "expenseid": 790,
    "status": "rejected",
    "information": "Missing receipts - please resubmit",
    "employeeid": 456
  },
  {
    "expenseid": 791,
    "status": "pending",
    "information": "Needs additional review",
    "employeeid": 456
  }
]
```

**Response (Single Approval Success - Invoice Created):**
```json
{
  "success": true,
  "invoiceId": 456,
  "invoiceNumber": "INV-20241120123000-0456-ABC123",
  "message": "Expense approved and invoice created"
}
```

**Response (Single Approval Success - Invoice Creation Failed):**
```json
{
  "success": true,
  "message": "Expense approved, but invoice creation failed",
  "error": "Merchant not found"
}
```

**Response (Bulk Same Status Approval Success - Invoices Created):**
```json
{
  "success": true,
  "count": 2,
  "invoiceId": 456,
  "invoiceNumber": "INV-20241120123000-0456-ABC123",
  "message": "Expenses approved and invoice created"
}
```

**Response (Mixed Statuses Bulk Success):**
```json
{
  "results": [
    {
      "status": "approved",
      "success": true,
      "count": 1,
      "invoiceId": 456,
      "invoiceNumber": "INV-20241120123000-0456-ABC123",
      "message": "Expenses approved and invoice created"
    },
    {
      "status": "rejected",
      "success": true,
      "count": 1
    },
    {
      "status": "pending",
      "success": true,
      "count": 1
    }
  ]
}
```

**Response (Error):**
```json
{
  "error": "Missing required decision parameters"
}
```

**Notes:**
- **Status values**: `"pending"`, `"approved"`, `"rejected"`
- **Information field**: Required for rejections (used as rejection message), optional for approvals
- **Transaction safety**: All bulk operations are atomic - if any decision fails, all changes are rolled back
- **Automatic Invoice Creation**: When expenses are approved, invoices are automatically created containing all approved expenses from that approval batch
- **Invoice Total Calculation**: The invoice total is automatically calculated as the sum of all approved expense amounts
- **Merchant Assignment**: The invoice merchant is automatically determined from the approved expenses (uses the most common merchant if expenses have different merchants)
- **Mixed Status Handling**: When processing expenses with mixed statuses, only approved expenses are invoiced together - rejected expenses are simply marked as rejected
- **Grouping Logic**: Approved expenses are grouped by approval batch, not by original creation group - this ensures efficient payment processing
- **Invoice Details**: Uses today's date, default merchant (configurable), and calculates total from expense amounts
- **Limits**: Maximum 50 decisions per request
- **Role access**: Admin/Manager permissions required for approval decisions
- **Backward compatibility**: Single decision format still supported

---

## 2. Expense Categories

### 2.1 Create Expense Category
**Endpoint:** `POST /api/v1/expense/new/category`

**Query Parameters:**
- `tenantId` (number, required)
- `employeeid` (number, required)

**Request Body:**
```json
{
  "category": "Travel"
}
```

**Response:**
```json
{
  "status": true
}
```

### 2.2 Get All Expense Categories
**Endpoint:** `GET /api/v1/expense/get/category`

**Query Parameters:**
- `tenantId` (number, required)

**Response:**
```json
[
  {
    "id": 1,
    "category": "Office Supplies"
  },
  {
    "id": 2,
    "category": "Travel"
  }
]
```

---

## 3. Expense Merchants

### 3.1 Create Expense Merchant
**Endpoint:** `POST /api/v1/expense/merchant`

**Query Parameters:**
- `tenantId` (number, required)
- `employeeid` (number, required)

**Request Body:**
```json
{
  "name": "Office Depot",
  "contact": "555-0123",
  "address": "123 Main St"
}
```

**Response:**
```json
{
  "status": true
}
```

### 3.2 Get All Expense Merchants
**Endpoint:** `GET /api/v1/expense/merchants`

**Query Parameters:**
- `tenantId` (number, required)

**Response:**
```json
[
  {
    "id": 1,
    "name": "Office Depot",
    "contact": "555-0123"
  }
]
```

---

## 4. Receipt Management

### 4.1 Upload Receipt Images
**Endpoint:** `POST /api/v1/expenses/receipt/upload`

**Content-Type:** `multipart/form-data`

**Query Parameters:**
- `tenantId` (number, required)
- `id` (number, required): Expense ID

**Form Data:**
- `images`: Multiple image files (max 10, formats: jpg, png, pdf)

**Response:**
```json
{
  "status": true,
  "uploaded": ["receipt-789-123456789.jpg"]
}
```

### 4.2 Get Receipt Images
**Endpoint:** `GET /api/v1/expenses/receipt/upload/images`

**Query Parameters:**
- `tenantId` (number, required)
- `expenseid` (number, required)

**Response:**
```json
{
  "images": ["receipt-789-123456789.jpg", "receipt-789-987654321.jpg"]
}
```

### 4.3 Delete Receipt Images
**Endpoint:** `DELETE /api/v1/expenses/receipt/uploaded/images`

**Query Parameters:**
- `tenantId` (number, required)

**Request Body:**
```json
{
  "expenseid": 789,
  "images": ["receipt-789-123456789.jpg"]
}
```

**Response:**
```json
{
  "status": true
}
```

---

## 5. Invoice Management

### 5.1 Automatic Invoice Creation
**Important:** Invoices are now automatically created when expenses are approved through the decision endpoint. Manual invoice creation is still available for special cases.

### 5.2 Create Expenses Only (For Later Invoicing) - DEPRECATED
**Endpoint:** `POST /api/v1/expenses/invoice/create-with-expenses`

**⚠️ DEPRECATED:** This endpoint is no longer recommended. Use the standard expense creation endpoint (`POST /api/v1/expenses`) instead, which automatically creates invoices when expenses are approved.

**Purpose:** Create expenses that can be invoiced later after approval (legacy endpoint - invoices are now auto-created on approval)

**Query Parameters:**
- `tenantId` (number, required)
- `employeeid` (number, required)
- `branchid` (number, required)

**Request Body:**
```json
{
  "expenses": [
    {
      "name": "Office Supplies",
      "amount": 150.00,
      "employeeid": 123,
      "branchid": 456,
      "description": "Bought pens and paper",
      "merchant": 1,
      "category": 2,
      "date": "2024-01-15"
    }
  ]
}
```

**Response:**
```json
{
  "status": {
    "message": "Expenses created successfully. Invoice can be created after expenses are approved.",
    "expenseIds": [789],
    "requiresApproval": true
  }
}
```

**Note:** This endpoint only creates expenses and does not create invoices. Use the standard expense creation flow instead.

---

### 5.3 Create Invoice Manually (Approved Expenses Only)
**Endpoint:** `POST /api/v1/expenses/invoice`

**Purpose:** Create an invoice for approved expenses manually (use only for special cases - invoices are normally auto-created on approval)

**Query Parameters:**
- `tenantId` (number, required)
- `employeeid` (number, required)
- `branchid` (number, required)

**Request Body:**
```json
{
  "expense_ids": [789, 790],
  "invoice_number": "INV-20240115-001", // Optional, auto-generated if not provided
  "invoice_date": "2024-01-15",
  "due_date": "2024-02-15",
  "merchant_id": 1,
  "total_amount": 300.00,
  "tax_amount": 30.00,
  "status": "Pending"
}
```

**Response:**
```json
{
  "status": {
    "invoiceId": 456,
    "invoice_number": "INV-20240115-001"
  }
}
```

**Error Response (Unapproved Expenses):**
```json
{
  "error": "Expense 789 must be approved before it can be invoiced"
}
```
**Endpoint:** `GET /api/v1/expenses/invoices`

**Query Parameters:**
- `tenantId` (number, required)
- `employeeid` (number, required)
- `branchid` (number, required)
- `page` (number, optional): Page number (default: 1)
- `count` (number, optional): Records per page (default: 10)
- `status` (string, optional): Filter by status
- `from` (string, optional): Start date (YYYY-MM-DD)
- `to` (string, optional): End date (YYYY-MM-DD)

**Response:**
```json
{
  "data": [
    {
      "id": 456,
      "invoice_number": "INV-20240115-001",
      "invoice_date": "2024-01-15",
      "due_date": "2024-02-15",
      "merchant_name": "Office Depot",
      "total_amount": 300.00,
      "tax_amount": 30.00,
      "status": "Pending",
      "expense_count": 2,
      "created_on": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 2,
    "totalRecords": 15,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

## 6. Payment Management

### 6.1 Add Payment
**Endpoint:** `POST /api/v1/expenses/payment`

**Query Parameters:**
- `tenantId` (number, required)
- `employeeid` (number, required)
- `branchid` (number, required)

**Request Body:**
```json
{
  "expense_id": 789,
  "invoice_id": 456, // Optional
  "payment_date": "2024-01-16",
  "amount": 150.00,
  "method": "Bank Transfer",
  "status": "Paid"
}
```

**Response:**
```json
{
  "status": {
    "paymentId": 123
  }
}
```

---

### 6.2 Get Payments
**Endpoint:** `GET /api/v1/expenses/payments`

**Query Parameters:**
- `tenantId` (number, required)
- `employeeid` (number, required)
- `branchid` (number, required)
- `expense_id` (number, optional): Filter by expense
- `invoice_id` (number, optional): Filter by invoice
- `status` (string, optional): Filter by payment status
- `page` (number, optional): Page number (default: 1)
- `count` (number, optional): Records per page (default: 10)

**Response:**
```json
{
  "data": [
    {
      "id": 123,
      "expense_id": 789,
      "invoice_id": 456,
      "payment_date": "2024-01-16",
      "amount": 150.00,
      "method": "Bank Transfer",
      "status": "Paid",
      "created_on": "2024-01-16T09:00:00Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 1,
    "totalRecords": 5,
    "hasNext": false,
    "hasPrev": false
  }
}
```

---

## 7. Expense Analytics & Reporting

### 7.1 Get Expense Audit Log
**Endpoint:** `GET /api/v1/expenses/audit/:expenseId`

**Purpose:** Get audit trail for an expense

**Query Parameters:**
- `tenantId` (number, required)

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "expense_id": 789,
      "action": "created",
      "old_value": null,
      "new_value": "Office Supplies",
      "changed_by": 123,
      "changed_on": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

## 8. Outsource Expense Management

### 8.1 Mark Outsourced Cases as Expenses
**Endpoint:** `POST /api/v1/outsourced/cases/mark-expense`

**Query Parameters:**
- `tenantId` (number, required)

**Request Body:**
```json
{
  "trackingId": "OUT-2024-001",
  "expenseData": {
    "amount": 500.00,
    "description": "Outsourced lab testing",
    "category": 3
  }
}
```

**Response:**
```json
{
  "status": true
}
```

---

## Error Handling

### Common Error Responses

**Validation Error:**
```json
{
  "error": "Required query parameters missing"
}
```

**Unauthorized:**
```json
{
  "error": "User not found"
}
```

**Not Found:**
```json
{
  "error": "Expense not found"
}
```

**Business Logic Error:**
```json
{
  "error": "Expense 789 must be approved before it can be invoiced"
}
```

---

## Data Types & Constraints

### Expense Status Values
- `0`: Pending
- `1`: Approved
- `2`: Rejected

### Invoice Status Values
- `"Pending"`
- `"Approved"`
- `"Rejected"`
- `"Paid"`

### Payment Status Values
- `"Paid"`
- `"Pending"`
- `"Failed"`

### Payment Methods
- `"Cash"`
- `"Bank Transfer"`
- `"Check"`
- `"Credit Card"`
- `"Online Payment"`

---

## Rate Limiting
- All endpoints are protected with rate limiting
- Handle `429 Too Many Requests` responses appropriately

## File Upload Limits
- Receipt images: Maximum 10 files per expense
- Supported formats: JPG, PNG, PDF
- Maximum file size: 5MB per file

---

## Workflow Examples

### Complete Expense to Invoice Flow (with Automatic Invoice Creation)

1. **Create Expense(s):**
   ```javascript
   // Single expense
   POST /api/v1/expenses
   {
     "name": "Office Supplies",
     "amount": 150.00,
     "employeeid": 123,
     "branchid": 456,
     "description": "Bought pens and paper",
     "merchant": 1,
     "category": 2,
     "date": "2024-01-15"
   }
   
   // OR bulk expenses (up to 50 at once)
   POST /api/v1/expenses
   [
     {
       "name": "Office Supplies",
       "amount": 150.00,
       "employeeid": 123,
       "branchid": 456,
       "description": "Bought pens and paper",
       "merchant": 1,
       "category": 2,
       "date": "2024-01-15"
     },
     {
       "name": "Travel Expenses",
       "amount": 250.00,
       "employeeid": 123,
       "branchid": 456,
       "description": "Taxi fare to client meeting",
       "merchant": 2,
       "category": 3,
       "date": "2024-01-16"
     }
   ]
   // Expense(s) created with status: Pending
   ```

2. **Upload Receipt:**
   ```javascript
   POST /api/v1/expenses/receipt/upload
   // Attach supporting documents
   ```

3. **Approve Expense(s) (Admin/Manager) - Automatic Invoice Creation:**
   ```javascript
   // Single expense approval (invoice automatically created)
   POST /api/v1/expense/pending/decision
   {
     "expenseid": 789,
     "status": "approved",
     "information": "Approved for office supplies",
     "employeeid": 456
   }
   // Response: Expense approved + Invoice automatically created
   
   // OR bulk approval (same status for all - invoice automatically created)
   POST /api/v1/expense/pending/decision
   {
     "status": "approved",
     "decisions": [
       {
         "expenseid": 789,
         "information": "Approved for office supplies",
         "employeeid": 456
       },
       {
         "expenseid": 790,
         "information": "Approved for travel expenses",
         "employeeid": 456
       }
     ]
   }
   // Response: Expenses approved + Single invoice automatically created for all approved expenses
   
   // OR bulk approval (mixed statuses - invoices only for approved expenses)
   POST /api/v1/expense/pending/decision
   [
     {
       "expenseid": 789,
       "status": "approved",
       "information": "Approved for office supplies",
       "employeeid": 456
     },
     {
       "expenseid": 790,
       "status": "rejected",
       "information": "Missing receipts - please resubmit",
       "employeeid": 456
     }
   ]
   // Response: Expense 789 approved + Invoice created, Expense 790 rejected
   // Expense status(es) updated with transaction safety
   ```

4. **Invoice Ready for Payment Processing:**
   ```javascript
   // Invoice already created automatically - ready for payment
   GET /api/v1/expenses/invoices
   // Returns the automatically created invoice
   ```

5. **Record Payment (Optional - Manual Payment Recording):**
   ```javascript
   POST /api/v1/expenses/payment
   // Payment recorded against the automatically created invoice
   ```

This documentation covers all expense and invoice management functionality. For additional support or clarifications, please refer to the backend team.