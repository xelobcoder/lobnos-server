# Expense Service Documentation

## Overview
The `Expenses` class implements `IExpenseRepository` and handles core expense management operations including:
- Expense record creation and management
- Expense approval workflows
- Financial calculations and reporting
- Receipt image management
- Expense category administration

## Public Methods

### `generateNewExpense(tenantId: number, data: ExpenseData): Promise<boolean>`
Creates a new expense record with validation checks

**Parameters:**
- `tenantId`: Tenant identifier
- `data`: Expense data object containing:
  - employeeid: Employee ID
  - branchid: Branch ID
  - name: Expense name
  - date: Expense date
  - amount: Expense amount
  - mode: Payment mode
  - category: Expense category ID

**Returns:** Promise resolving to boolean indicating success

---

### `getExpensesRecord(...)`
Retrieves paginated expense records with filtering capabilities

**Filter Options:**
- Status (approved/pending/rejected)
- Date range
- State
- Role-based access control

---

### `getMonthlySummary(tenantId: number)`
Generates monthly expense report for all 12 months

**Returns:** Object with month numbers as keys and expense totals as values

---

## Interfaces
```typescript
interface IExpenseRepository {
    // Full interface definition in:
    // src\models\Expenses\interfaces\IExpenseRepository.ts
}

interface ExpenseData {
    // Defined in:
    // src\models\Expenses\interfaces\types.ts
}