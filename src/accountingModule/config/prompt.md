You are a senior software architect specializing in healthcare systems, laboratory information management systems (LIMS), and financial accounting modules.

I have an existing Laboratory Information Management System (LIMS) built with:
- Backend: Node.js + Express
- Database: MySQL
- Frontend: web-based application
- Existing modules: patient registration, test ordering, billing, results, inventory, and branch-based operations

I want to integrate a full accounting module directly into this existing LIMS, not as a separate application.

Your task is to generate a detailed implementation plan for embedding accounting into the current system.

Requirements:

1. The accounting system must support double-entry bookkeeping.
2. Every financial activity in the LIMS should automatically create journal entries.
3. The system must support:
   - Chart of accounts
   - Journal entries
   - General ledger
   - Trial balance
   - Balance sheet
   - Income statement
   - Accounts receivable
   - Accounts payable
   - Expense tracking
   - Revenue tracking
4. It must integrate with existing LIMS modules:
   - Billing
   - Inventory
   - Procurement
   - Payroll
   - Branch management
5. The architecture should work for multi-branch laboratories where some branches may operate offline and later sync to central database.
6. The accounting module should maintain audit trails and source linking so every accounting entry can be traced back to originating LIMS records.
7. The design should support role-based access:
   - cashier
   - accountant
   - manager
   - admin

Please provide:

A. System architecture
- modules to create
- service interactions
- event flow
- synchronization considerations

B. Database design
- exact tables needed
- relationships
- sample schema
- indexing strategy

C. Backend implementation
- how to structure services
- utility functions for automatic journal posting
- transaction handling
- rollback strategy

D. Integration points
For each existing module (billing, inventory, payroll), explain:
- which events should trigger accounting entries
- sample debit/credit postings

E. UI/UX modules
List screens needed:
- accounting dashboard
- journal browser
- ledger viewer
- financial reports
- account setup

F. Deployment strategy
Given that branches may run local servers with intermittent internet:
- explain how accounting data sync should work
- conflict handling
- central reporting architecture

G. Security
- audit trail
- access control
- fraud prevention
- data integrity

H. Development roadmap
Break implementation into phases:
- phase 1 minimum viable accounting
- phase 2 automation
- phase 3 reporting
- phase 4 branch consolidation

Generate the response as a practical engineering blueprint suitable for direct development.

The class for thr accounting module should optionally receive a transaction connection if it so exists