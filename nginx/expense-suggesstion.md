Here is a prompt you can give directly to your coding AI. I’ve made it explicit enough that it should understand the intended workflow without making assumptions.

I want you to redesign and implement the **Expense Management workflow** in my Laboratory Information Management System (LIMS/PLS).

The goal is to make the expense module suitable for a proper enterprise system with strong approval controls, segregation of duties, audit trails, and future accounting integration.

### 1. Core principle

Do NOT design the workflow purely around job titles such as Cashier, Customer Sales Representative, Accountant, or Admin.

Instead, design it around:

* Permissions
* Approval limits
* Segregation of duties
* Expense status
* Approval workflow
* Payment workflow
* Accounting integration
* Complete audit trail

Users can have different roles, but their actual ability to perform an action should be controlled by permissions and approval limits.

---

### 2. Expense lifecycle

The standard expense lifecycle should be:

```text
DRAFT
   ↓
SUBMITTED
   ↓
PENDING_APPROVAL
   ↓
APPROVED
   ↓
PAYMENT_PENDING
   ↓
PAID
```

Alternative paths:

```text
PENDING_APPROVAL → REJECTED
```

and:

```text
APPROVED → CANCELLED
```

A rejected expense should be editable and resubmittable:

```text
REJECTED
   ↓
EDITED
   ↓
RESUBMITTED
   ↓
PENDING_APPROVAL
```

Do not permanently delete approved or paid expenses. They should be cancelled, reversed, or otherwise corrected while preserving the original transaction and audit history.

---

### 3. When a Cashier / Customer Sales Representative / Accountant creates an expense

For example:

A cashier purchases stationery for GHS 150.

The user creates an expense containing information such as:

* Expense category
* Merchant/vendor
* Amount
* Expense date
* Description/reason
* Facility/branch
* Payment method
* Receipt/invoice attachment
* Requester/employee
* Cost centre where applicable
* Reference number

When submitted, it becomes:

```text
PENDING_APPROVAL
```

The person who created the expense should not be allowed to approve their own expense unless an explicit system configuration/permission allows this for a particular organization.

The approval should therefore be performed by another authorized user.

---

### 4. Approval limits

Approval should be based on configurable monetary limits rather than only job titles.

For example:

```text
GHS 0–100       → Supervisor
GHS 101–1,000   → Accountant/Manager
GHS 1,001–5,000 → Facility Administrator/Manager
Above GHS 5,000 → Senior Administrator/Owner
```

These are examples only.

The actual limits must be configurable per facility/tenant.

A user should have an approval limit such as:

```text
approval_limit = 5000
```

A user should not be able to approve an expense above their authorized approval limit.

---

### 5. Permissions

Design the system around granular permissions such as:

```text
expense.create
expense.view
expense.edit
expense.submit
expense.approve
expense.reject
expense.pay
expense.cancel
expense.reverse
expense.override_approval
expense.view_audit
```

The exact permission naming can follow the existing project's permission convention.

A user may have:

```text
create_expense = true
approve_expense = true
payment = true
approval_limit = 2000
```

while another user may have:

```text
create_expense = true
approve_expense = true
payment = false
approval_limit = 10000
```

Do not assume that every Admin can automatically approve everything.

Admin access should still respect approval limits and organizational controls unless they have a specific override permission.

---

### 6. Separate approval from payment

Approval and payment are two separate events.

For example:

```text
Expense:
Printer toner
Amount: GHS 500
```

After approval:

```text
APPROVED
```

It should then become:

```text
PAYMENT_PENDING
```

The authorized finance/cashier user can then record the actual payment.

Payment information should include:

* Amount paid
* Payment method
* Cash account/bank account/mobile money account
* Payment date
* Payment reference
* Paid by
* Supporting document where applicable

After successful payment:

```text
PAID
```

The user who approves an expense should ideally not be the same user who pays it where segregation-of-duties controls require separation.

---

### 7. Support different payment scenarios

The system should be able to support:

1. Direct cash payment
2. Bank payment
3. Mobile money payment
4. Supplier credit / Accounts Payable
5. Employee reimbursement

For example, if the laboratory owes a supplier:

```text
APPROVED
   ↓
PAYMENT_PENDING
   ↓
PAYABLE
   ↓
PAID
```

If an employee paid from personal funds:

```text
APPROVED
   ↓
REIMBURSEMENT_PENDING
   ↓
REIMBURSED
```

The architecture should allow these payment types without having to redesign the expense module later.

---

### 8. Separate Expense Request from actual Expense where appropriate

The system should support the concept of an **Expense Request**.

An Expense Request means:

> "I am requesting authorization to spend money."

An Expense means:

> "The expenditure actually occurred."

For example:

```text
EXPENSE REQUEST
New printer
Estimated amount: GHS 2,500
       ↓
APPROVAL
       ↓
PURCHASE
       ↓
ACTUAL EXPENSE
Actual amount: GHS 2,350
       ↓
PAYMENT
```

Do not force these two concepts into one record if doing so would compromise accounting accuracy.

Design the data model so that an approved request can eventually result in one or more actual expenses/payment transactions where appropriate.

---

### 9. Accounting integration

The expense module should be designed so that it can integrate with the accounting module later.

For a simple cash expense:

```text
Dr. Expense Account       GHS 500
    Cr. Cash/Bank         GHS 500
```

For an expense purchased on credit:

```text
Dr. Expense Account       GHS 500
    Cr. Accounts Payable  GHS 500
```

When the payable is subsequently settled:

```text
Dr. Accounts Payable      GHS 500
    Cr. Cash/Bank         GHS 500
```

Do not hard-code these accounting rules into the UI.

The system should eventually derive the accounting entries based on the expense category/account, payment method, supplier, and accounting configuration.

---

### 10. Audit trail

Every significant action must be auditable.

Track at minimum:

```text
createdBy
createdAt

submittedBy
submittedAt

approvedBy
approvedAt

rejectedBy
rejectedAt
rejectionReason

paidBy
paidAt

cancelledBy
cancelledAt
cancellationReason

reversedBy
reversedAt
reversalReason
```

Also record status changes and relevant changes to important financial fields.

The audit trail should make it possible to answer:

* Who created the expense?
* Who submitted it?
* Who approved it?
* Who rejected it?
* Why was it rejected?
* Who paid it?
* When was it paid?
* Which account was used?
* Who cancelled/reversed it?
* What was the original amount?
* What was the final amount?

---

### 11. Multi-tenant / multi-facility considerations

This is a multi-facility laboratory system.

Every expense, approval, payment, and accounting transaction must belong to the correct tenant/facility/branch context.

Do not allow a user from Facility A to approve, view, modify, or pay an expense belonging to Facility B unless the user's permissions explicitly allow cross-facility access.

The existing tenancy/database-context architecture must be respected.

---

### 12. Existing database

Before changing the database:

1. Inspect the existing expense-related tables and code.
2. Understand the current `expensesrecord` structure and existing relationships.
3. Identify existing fields such as:

   * date
   * merchant
   * amount
   * employeeid
   * branchid
   * approved
   * approvedby
   * rejectionmessage
   * groupId
4. Preserve existing functionality where possible.
5. Do not unnecessarily destroy or rename existing data.
6. If migration is required, create a safe migration strategy for existing records.

Do not simply replace the existing implementation without understanding how it is currently used.

---

### 13. UI expectations

The UI should clearly show the expense's current state.

For example:

```text
Draft
Submitted
Pending Approval
Approved
Rejected
Payment Pending
Paid
Cancelled
Reversed
```

The available actions should depend on:

* Current status
* User permissions
* User approval limit
* User's facility/branch access
* Whether the user created the expense
* Whether payment has already occurred

For example:

A user viewing a pending expense might see:

```text
Approve
Reject
View Details
```

An authorized finance user viewing an approved expense might see:

```text
Record Payment
View Details
```

The creator should not see an approval button for their own expense unless explicitly permitted.

---

### 14. Do not implement blindly

Before making code changes:

1. Inspect the existing expense implementation.
2. Inspect the current user/role/permission system.
3. Inspect the existing facility/branch/tenant architecture.
4. Inspect existing accounting-related tables if present.
5. Identify what can be reused.
6. Identify what must be changed.
7. Explain the proposed database and workflow changes.
8. Then implement them incrementally.

Do not introduce a completely separate permission or authentication system if one already exists.

Follow the existing project's architecture, coding conventions, database conventions, and naming conventions.

The final implementation should be robust enough to support future modules such as:

* Accounts Payable
* General Ledger
* Cash management
* Bank reconciliation
* Budgets
* Purchase Orders
* Supplier management
* Financial reporting
* Cost centres

The objective is to turn the current basic expense-recording functionality into a proper **enterprise expense and expenditure management workflow**, while maintaining compatibility with the existing PLS system.

This prompt should make the AI **inspect your existing implementation first**, rather than immediately creating a new expense system that conflicts with your current PLS architecture.
 
Yes — **absolutely**. In an enterprise LIMS, the payment record should identify both **where the money came from** and **who executed the payment**.

### Payment record
When an approved expense is paid, capture at least:

FieldExamplePayment source/accountMain Cash / Ecobank Account / MTN MoMoPayment methodCash / Bank / MoMoAmount paidGHS 500Payment date20 Sept 2026Paid byAccountant: AbdulPayment referenceTRX-84932RecipientABC Supplies LtdSupporting documentReceipt/payment confirmationSo the workflow becomes:

**Expense created → Approved → Payment pending → Payment recorded → Paid**

And the payment record says:

> **Paid from:** Main Cash
> **Paid by:** Accountant
> **Payment method:** Cash
> **Amount:** GHS 500

### Why "payment source" is important
Don't just store `payment_method = cash`.

You need to distinguish **the actual financial account**.

For example:

```
Payment method: Cash
Payment source: Main Cash Account
```
versus:

```
Payment method: Bank Transfer
Payment source: Ecobank Operating Account
```
versus:

```
Payment method: Mobile Money
Payment source: MTN MoMo Business Account
```
This becomes extremely important when you later implement **cash balances, bank reconciliation, cash-flow reporting, and the General Ledger**.

### Who does the payment?
The **payment executor** should be the authenticated user who actually records/executes the payment.

For example:

```
approvedBy = Facility Manager
paidBy     = Accountant
```
Those should be separate fields.

I would also capture:

```
approvedAt
approvedBy

paidAt
paidBy

paymentSourceId
paymentMethod
paymentReference
amountPaid
```
And ideally, if the system actually integrates with a payment provider/bank later, distinguish between:

**"Recorded by"** and **"Executed by."**

For example, an accountant might enter a payment that was physically made by the facility manager. That's a useful distinction for a mature accounting system.

**So yes: payment source + payment method + who paid/recorded it should all be part of the payment transaction, not merely the expense record.**
Yes. **Put payment authorization in permissions**, but don't make it a simple `Admin = can pay`. For PLS, I would use **permissions + payment-account access + approval limits**.

### Recommended structure
A facility may have:

- Cashier
- Customer Sales Representative
- Accountant
- Facility Manager
- Administrator
- Owner/Director
But these are roles. The actual authority should come from permissions.

For example:

PermissionCashierCSRAccountantManagerAdminCreate expense✓✓✓✓✓Approve expenseMaybeNo✓✓✓Pay expenseMaybeNo✓Maybe✓Cancel paymentNoNoMaybe✓✓View payment records✓✓✓✓✓The exact assignment should be configurable by the facility.

### But I would add one more layer
Suppose an accountant has:

> `expense.pay = true`
That doesn't necessarily mean they can pay from **every account**.

You could have:

```
Account access
────────────────────────
Main Cash             ✓
Petty Cash            ✓
Ecobank Account       ✓
MTN MoMo              ✗
```
So your authorization becomes:

**Can this user pay?**

→ `expense.pay`

**Can this user pay from this particular account?**

→ `payment_account.access`

**Is the expense approved and within the required workflow?**

→ Status/approval rules

That gives you much stronger financial controls.

### Example
A cashier might be authorized to pay petty-cash expenses:

> Expense: GHS 150
> Status: APPROVED
> Payment source: Petty Cash
> Cashier: Authorized ✓
But the same cashier attempts:

> Expense: GHS 8,000
> Payment source: Ecobank Operating Account
The system should reject the action because the cashier doesn't have access to that payment account.

### Also separate approval from payment
I strongly recommend:

```
Creator
   ↓
Approver
   ↓
Payment Executor
```
They **can** be different people.

For example:

> CSR creates GHS 800 expense
> Accountant approves
> Accountant pays
Or, depending on your facility's policy:

> CSR creates
> Facility Manager approves
> Accountant pays
The important thing is that the system **doesn't hard-code who these people must be**. The facility configures it through permissions and approval rules.

### One important rule
I would make this a system-level control:

> **A user cannot approve their own expense and then pay it**, unless the facility explicitly enables that behavior for a permitted low-risk workflow.
For larger organizations, you can enforce segregation of duties:

```
CREATE ≠ APPROVE ≠ PAY
```
For a small laboratory, you may allow some combination where necessary.

So yes, **authorization to pay belongs in your permission system**, but I would model it as:

**Role → Permission → Payment-account access → Approval limit/workflow**

rather than simply saying *"Accountants can pay expenses."*


Exactly. **That is the stronger design for PLS.**

Each payment account should have its own **authorized users**, rather than assuming that everyone with `expense.pay` can pay from every account.

For example:

```
Payment Accounts

Main Cash
 ├── Accountant ✓
 ├── Cashier ✓
 └── Facility Manager ✓

Ecobank Operating Account
 ├── Accountant ✓
 └── Facility Manager ✓

MTN MoMo Business
 ├── Accountant ✓
 └── Admin ✓
```
But I would implement this as a **many-to-many relationship**, not by putting a single `userId` on the account.

### Example database concept

```
payment_accounts
----------------
id
name
account_type
currency
branch_id
is_active
```
Then:

```
payment_account_users
---------------------
id
payment_account_id
user_id
can_pay
can_view
can_reconcile
```
This allows one user to access multiple accounts and one account to have multiple authorized users.

For example:

```
                    Main Cash    Ecobank    MTN MoMo
Accountant             ✓            ✓          ✓
Cashier                ✓            ✗          ✗
Admin                  ✗            ✓          ✓
Manager                ✓            ✓          ✓
```

### Then your payment authorization becomes very clean
When the accountant tries to pay an expense:

```
Can user pay expenses?
        ↓
      YES
        ↓
Is expense approved?
        ↓
      YES
        ↓
Does user have payment access to selected account?
        ↓
      YES
        ↓
Is payment within applicable authorization limit?
        ↓
      YES
        ↓
      PAY
```
This is much better than simply having:

```
if user.role === "accountant"
    allow payment
```
because your facilities may have completely different financial structures.

Also, **account ownership and payment authorization should be separate concepts**. The facility may own an Ecobank account, but only two employees may be authorized to initiate payments from it.

That structure will also make your future **bank reconciliation, cash management, GL, audit trail, and financial controls** much easier to build.


Good. That gives your PLS expense/payment module a solid foundation:

**Expense → Approval → Authorized Payment Account → Authorized Payer → Payment → Accounting/Audit Trail**

And the authorization can remain configurable per facility rather than being hard-coded to job titles.