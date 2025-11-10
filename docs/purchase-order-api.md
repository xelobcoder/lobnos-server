# Purchase Order API Documentation

## Overview

The Purchase Order API provides comprehensive functionality for managing purchase orders in the inventory system. It supports the complete purchase order lifecycle from creation to receiving, with granular item management capabilities.

## Base URL
```
inventory
```

## Authentication
All endpoints require proper authentication and tenant context via query parameter `tenantId`.

---

## Purchase Order Endpoints

### 1. Create Purchase Order
**Endpoint:** `POST /orders`

**Description:** Creates a new purchase order with associated items.

**Request Body:**
```json
{
  "supplier_id": "SUP-1762711421251",
  "order_date": "2025-11-10",
  "expected_delivery_date": "2025-11-21T00:00:00.000Z",
  "payment_terms": "Net 30",
  "tax_amount": 0,
  "discount_amount": 0,
  "shipping_cost": 0,
  "currency": "USD",
  "notes": "Purchase order notes",
  "status": "draft",
  "communication_method": "email",
  "communication_notes": "Communication details",
  "items": [
    {
      "item_id": "INV-1762706794784",
      "quantity": 10,
      "unit_price": 25.50,
      "tax_rate": 8.5,
      "discount_rate": 0,
      "notes": "Item specific notes"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "order": {
      "id": "ORD-1762711421251",
      "order_number": "PO-2025-001",
      "supplier_id": "SUP-1762711421251",
      "supplier_name": "ABC Supplies Inc.",
      "supplier_contact": "John Doe",
      "supplier_email": "john@abc.com",
      "supplier_phone": "+1234567890",
      "supplier_address": "123 Main St, City, State",
      "order_date": "2025-11-10",
      "expected_delivery_date": "2025-11-21T00:00:00.000Z",
      "status": "draft",
      "total_amount": 255.00,
      "tax_amount": 0,
      "discount_amount": 0,
      "shipping_cost": 0,
      "final_amount": 255.00,
      "currency": "USD",
      "payment_terms": "Net 30",
      "notes": "Purchase order notes",
      "items_count": 1,
      "received_items_count": 0,
      "items": [...]
    }
  }
}
```

---

### 2. Get Purchase Orders
**Endpoint:** `GET /orders`

**Description:** Retrieves a paginated list of purchase orders with optional filtering.

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `count` (number): Items per page (default: 25)
- `sortby` (string): Sort order - "ASC" or "DESC" (default: "DESC")
- `supplier_id` (string): Filter by supplier ID
- `supplier_name` (string): Filter by supplier name (partial match)
- `status` (string|string[]): Filter by status(es)
- `startDate` (string): Filter orders from this date
- `endDate` (string): Filter orders until this date
- `search` (string): Search in order number, supplier name, or notes

**Response:**
```json
{
  "success": true,
  "data": {
    "orders": [...],
    "total": 150,
    "page": 1,
    "count": 25,
    "totalPages": 6,
    "sortby": "DESC"
  },
  "pagination": {
    "page": 1,
    "count": 25,
    "total": 150,
    "totalPages": 6,
    "sortby": "DESC"
  }
}
```

---

### 3. Get Purchase Order by ID
**Endpoint:** `GET /orders/:id`

**Description:** Retrieves a specific purchase order with full details including all items.

**Response:** Same structure as create response, includes complete order details with items array.

---

### 4. Update Purchase Order
**Endpoint:** `PUT /orders/:id`

**Description:** Updates a purchase order. For unreceived orders, allows full item replacement. For received orders, only allows header updates.

**Request Body:** (all fields optional)
```json
{
  "supplier_id": "SUP-1762711421251",
  "order_date": "2025-11-10",
  "expected_delivery_date": "2025-11-21T00:00:00.000Z",
  "status": "draft",
  "payment_terms": "Net 30",
  "tax_amount": 0,
  "discount_amount": 0,
  "shipping_cost": 0,
  "currency": "USD",
  "notes": "Updated notes",
  "items": [
    {
      "inventory_item_id": "INV-1762706794784",
      "quantity_ordered": 15,
      "unit_price": 25.50,
      "tax_rate": 8.5,
      "discount_rate": 0
    }
  ]
}
```

---

### 5. Delete Purchase Order
**Endpoint:** `DELETE /orders/:id`

**Description:** Deletes a purchase order (only allowed for draft status).

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Purchase order deleted successfully"
  }
}
```

---

### 6. Get Purchase Order Items
**Endpoint:** `GET /orders/:id/items`

**Description:** Retrieves all items for a specific purchase order.

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "POI-1762711421251",
        "order_id": "ORD-1762711421251",
        "inventory_item_id": "INV-1762706794784",
        "item_name": "EDTA Solution",
        "item_description": "Ethylenediaminetetraacetic acid",
        "sku": "EDTA-001",
        "quantity_ordered": 10,
        "quantity_received": 0,
        "quantity_rejected": 0,
        "unit_price": 25.50,
        "tax_rate": 8.5,
        "discount_rate": 0,
        "line_total": 255.00,
        "unit": "bottles",
        "status": "pending",
        "notes": "Item notes",
        "created_at": "2025-11-10T10:00:00.000Z",
        "updated_at": "2025-11-10T10:00:00.000Z"
      }
    ]
  }
}
```

---

### 7. Receive Purchase Order
**Endpoint:** `POST /orders/:id/receive`

**Description:** Processes receipt of items for a purchase order.

**Request Body:**
```json
{
  "order_id": "ORD-1762711421251",
  "received_by": "John Doe",
  "received_date": "2025-11-10T14:30:00.000Z",
  "receipts": [
    {
      "order_item_id": "POI-1762711421251",
      "quantity_received": 8,
      "batch_number": "BATCH-001",
      "expiry_date": "2026-11-10",
      "condition_status": "good",
      "quality_check_passed": true,
      "storage_location_id": "LOC-001",
      "notes": "Received in good condition"
    }
  ]
}
```

---

### 8. Approve Purchase Order
**Endpoint:** `POST /orders/:id/approve`

**Description:** Approves a purchase order, changing its status to 'approved'.

**Request Body:**
```json
{
  "approved_by": "Jane Smith"
}
```

---

### 9. Send Purchase Order
**Endpoint:** `POST /orders/:id/send`

**Description:** Marks a purchase order as sent to the supplier.

**Request Body:**
```json
{
  "sent_at": "2025-11-10T15:00:00.000Z"
}
```

---

## Item Management Endpoints

### 10. Update Purchase Order Item
**Endpoint:** `PUT /orders/:orderId/items/:itemId`

**Description:** Updates a specific item in a purchase order (only for unreceived orders).

**Request Body:** (all fields optional)
```json
{
  "quantity_ordered": 15,
  "unit_price": 22.00,
  "tax_rate": 10.0,
  "discount_rate": 5.0,
  "notes": "Updated specifications"
}
```

---

### 11. Add Purchase Order Item
**Endpoint:** `POST /orders/:orderId/items`

**Description:** Adds a new item to an existing purchase order (only for unreceived orders).

**Request Body:**
```json
{
  "item_id": "INV-1762706794784",
  "quantity": 10,
  "unit_price": 25.50,
  "tax_rate": 8.5,
  "discount_rate": 0,
  "notes": "Additional item"
}
```

---

### 12. Remove Purchase Order Item
**Endpoint:** `DELETE /orders/:orderId/items/:itemId`

**Description:** Removes an item from a purchase order (only for unreceived orders).

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Purchase order item removed successfully"
  }
}
```

---

## Status Values

### Purchase Order Statuses
- `draft` - Initial status, can be modified
- `pending_approval` - Awaiting approval
- `approved` - Approved, ready to send
- `sent` - Sent to supplier
- `confirmed` - Confirmed by supplier
- `partially_received` - Some items received
- `received` - All items received
- `cancelled` - Order cancelled

### Purchase Order Item Statuses
- `pending` - Not yet received
- `partially_received` - Some quantity received
- `received` - Fully received
- `cancelled` - Item cancelled
- `backordered` - Backordered by supplier

### Item Condition Statuses
- `good` - Item in good condition
- `damaged` - Item damaged
- `expired` - Item expired
- `incorrect_item` - Wrong item received

---

## Error Responses

All endpoints return errors in the following format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "supplier_id",
        "message": "Supplier ID is required",
        "value": null
      }
    ]
  }
}
```

### Common Error Codes
- `VALIDATION_ERROR` - Input validation failed
- `INTERNAL_ERROR` - Server error
- `NOT_FOUND` - Resource not found

---

## Business Rules

1. **Item Modification Restrictions**: Items can only be modified (added, updated, removed) if no items in the order have been received yet.

2. **Status Transitions**: Purchase orders follow a strict workflow with defined status transitions.

3. **Automatic Calculations**: Order totals are automatically recalculated when items are modified.

4. **Tenant Isolation**: All operations are scoped to the tenant specified in the request.

5. **Supplier Validation**: All suppliers must be active and exist in the system.

6. **Inventory Validation**: All inventory items must be active and exist in the system.

---

## Rate Limiting

- Standard API rate limits apply
- Bulk operations may have additional restrictions

---

## Version History

- **v1.0** - Initial implementation with full purchase order lifecycle support</content>
<parameter name="filePath">c:\Programming\PLS-DIFFERENT-VERSIONS\LobnosProfessionalVersion\lobnos-server\docs\purchase-order-api.md