# Purchase Order & Inventory Management Plan

## Overview

This plan outlines the implementation of a simplified purchase order system with integrated inventory management, focusing on core operations: ordering from suppliers, receiving goods with detailed tracking, inventory updates, and comprehensive transaction logging.

## Core Workflow

### 1. Purchase Order Creation
- Create orders to suppliers with item details
- Auto-generate order numbers (ORD-YYYY-NNNN)
- Calculate order totals and line items
- Initial status: 'ordered'

### 2. Order Receipt Processing
- Receive orders with detailed item information:
  - Batch number, quantity, expiry date
  - Unit price, discount, tax rates
  - Quality condition (good, acceptable, damaged)
- Process partial receipts
- Quality control checks
- Update actual costs from received pricing

### 3. Order Status Management
- Automatic status progression:
  - 'ordered' → 'partially_received' → 'received'
  - 'cancelled' for cancelled orders
- Status updates based on item receipt completion

### 4. Inventory Updates
- Add received quantities to inventory stock
- Only quality-approved items ('good', 'acceptable') update stock
- Maintain batch-specific inventory tracking
- Update inventory valuation with actual costs

### 5. Transaction Tracking
- Record all inventory movements with full details
- Track batches, brands, costs, and references
- Aggregate totals across all batches for each item
- Complete audit trail for compliance

## Database Schema

### inv_purchase_orders
```sql
CREATE TABLE inv_purchase_orders (
  id VARCHAR(50) PRIMARY KEY,
  order_id VARCHAR(100) NOT NULL UNIQUE,
  supplier_id VARCHAR(50) NOT NULL,
  order_date DATE NOT NULL,
  expected_delivery_date DATE,
  status ENUM('ordered', 'partially_received', 'received', 'cancelled') DEFAULT 'ordered',
  total_amount DECIMAL(12,2) DEFAULT 0.00,
  notes TEXT,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES inv_suppliers(id)
);
```

### inv_purchase_order_items
```sql
CREATE TABLE inv_purchase_order_items (
  id VARCHAR(50) PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL,
  inventory_item_id VARCHAR(50),
  quantity_ordered INT NOT NULL,
  quantity_received INT DEFAULT 0,
  unit_price DECIMAL(10,2) NOT NULL,
  tax_rate DECIMAL(5,2) DEFAULT 0.00,
  discount_rate DECIMAL(5,2) DEFAULT 0.00,
  line_total DECIMAL(12,2) NOT NULL,
  status ENUM('pending', 'partially_received', 'received', 'cancelled') DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES inv_purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (inventory_item_id) REFERENCES inv_inventory_items(id)
);
```

### inv_purchase_order_receipts
```sql
CREATE TABLE inv_purchase_order_receipts (
  id VARCHAR(50) PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL,
  order_item_id VARCHAR(50) NOT NULL,
  receipt_number VARCHAR(100) NOT NULL,
  received_date DATE NOT NULL,
  received_by VARCHAR(100),
  quantity_received INT NOT NULL,
  batch_number VARCHAR(100),
  expiry_date DATE,
  unit_price DECIMAL(10,2),
  tax_rate DECIMAL(5,2),
  discount_rate DECIMAL(5,2),
  condition_status ENUM('good', 'acceptable', 'damaged', 'expired') DEFAULT 'good',
  quality_check_passed BOOLEAN DEFAULT TRUE,
  notes TEXT,
  image_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES inv_purchase_orders(id),
  FOREIGN KEY (order_item_id) REFERENCES inv_purchase_order_items(id)
);
```

### inv_inventory_transactions
```sql
CREATE TABLE inv_inventory_transactions (
  id VARCHAR(50) PRIMARY KEY,
  item_id VARCHAR(50) NOT NULL,
  transaction_type ENUM('addition', 'consumption', 'adjustment', 'transfer') NOT NULL,
  quantity INT NOT NULL,
  previous_stock INT NOT NULL,
  new_stock INT NOT NULL,
  batch_number VARCHAR(100),
  expiry_date DATE,
  unit_cost DECIMAL(10,2),
  total_cost DECIMAL(12,2),
  brand_name VARCHAR(255),
  reason VARCHAR(255),
  reference_id VARCHAR(50),
  performed_by VARCHAR(100),
  transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES inv_inventory_items(id)
);
```

## API Endpoints

### Purchase Orders
- `POST /api/v1/inventory/orders` - Create purchase order
- `GET /api/v1/inventory/orders` - List orders with filtering
- `GET /api/v1/inventory/orders/:id` - Get order details
- `PUT /api/v1/inventory/orders/:id` - Update order (pre-receipt only)
- `DELETE /api/v1/inventory/orders/:id` - Cancel order

### Order Items
- `GET /api/v1/inventory/orders/:id/items` - Get order items
- `PUT /api/v1/inventory/orders/:id/items/:itemId` - Update order item

### Receipts
- `POST /api/v1/inventory/orders/:id/receive` - Process order receipt
- `GET /api/v1/inventory/orders/:id/receipts` - Get order receipts
- `POST /api/v1/inventory/receipts/:id/image` - Upload receipt image

### Transactions
- `GET /api/v1/inventory/transactions` - List transactions
- `GET /api/v1/inventory/items/:id/transactions` - Item transaction history
- `POST /api/v1/inventory/transactions` - Manual transaction entry

## Implementation Phases

### Phase 1: Foundation 
1. Create database tables and migrations
2. Implement PurchaseOrder and PurchaseOrderItem models
3. Set up basic CRUD operations
4. Create transaction logging system

### Phase 2: Order Management
1. Implement order creation with auto-numbering
2. Add order item management
3. Implement order status logic
4. Create order listing and filtering

### Phase 3: Receipt Processing 
1. Build receipt processing logic
2. Implement quality control checks
3. Add batch and expiry tracking
4. Integrate inventory updates

### Phase 4: Transaction Tracking 
1. Complete transaction logging for all movements
2. Implement batch aggregation
3. Add transaction reporting
4. Create audit trails

### Phase 5: Integration & Testing 
1. Connect with existing inventory system
2. Add comprehensive validation
3. Implement error handling
4. Full system testing

## Business Logic

### Order Creation
- Validate supplier exists and is active
- Calculate line totals: `quantity * unit_price * (1 + tax_rate/100) * (1 - discount_rate/100)`
- Sum line totals for order total
- Generate unique order number

### Receipt Processing
- Allow partial receipts (quantity_received ≤ quantity_ordered - already_received)
- Update order item status based on completion
- Only 'good' and 'acceptable' items update inventory
- Create transaction records for inventory changes
- Update order status automatically

### Inventory Updates
- Add received quantities to item.current_stock
- Update item valuation with weighted average costs
- Track batch-specific information
- Maintain stock level integrity

### Transaction Logging
- Every inventory change creates a transaction
- Include all relevant details (batch, cost, reference)
- Support different transaction types
- Enable complete audit trails

## Technical Considerations

### Performance
- Index frequently queried columns (order_date, status, item_id)
- Implement pagination for large datasets
- Cache frequently accessed inventory data
- Optimize transaction queries

### Data Integrity
- Use database transactions for multi-step operations
- Implement foreign key constraints
- Validate data at API and database levels
- Maintain referential integrity

### Security
- Implement role-based access control
- Audit all inventory changes
- Validate user permissions for operations
- Secure file uploads for receipt images

### Scalability
- Design for high transaction volumes
- Implement efficient batch processing
- Consider database partitioning for large datasets
- Plan for multi-tenant support

## Testing Strategy

### Unit Tests
- Model methods and business logic
- Validation functions
- Calculation methods (totals, costs)

### Integration Tests
- Complete order → receipt → inventory workflow
- Transaction logging accuracy
- API endpoint functionality

### End-to-End Tests
- Full user workflows
- Data consistency across operations
- Performance under load

### Data Validation
- Stock level accuracy
- Transaction record completeness
- Order status progression
- Financial calculation accuracy

## Success Criteria

- ✅ Orders can be created and tracked
- ✅ Receipts process with full detail capture
- ✅ Inventory updates accurately
- ✅ All transactions are logged and auditable
- ✅ Batch and brand tracking works
- ✅ System performs under expected load
- ✅ Data integrity maintained
- ✅ User workflows are intuitive

## Risk Mitigation

- **Data Loss**: Regular backups and transaction logging
- **Performance Issues**: Database optimization and monitoring
- **User Errors**: Comprehensive validation and confirmation dialogs
- **Integration Issues**: Thorough testing of existing system connections
- **Compliance**: Complete audit trails and regulatory reporting

## Future Enhancements

- Automated reordering based on low stock
- Supplier performance analytics
- Advanced reporting and dashboards
- Mobile app for receipt processing
- Integration with accounting systems
- Predictive analytics for inventory planning