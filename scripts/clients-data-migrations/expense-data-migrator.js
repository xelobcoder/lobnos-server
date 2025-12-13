const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Database configuration (migrated old database with new schema)
const dbConfig = {
     host: 'localhost',
     user: 'primelab',
     password: 'Barcelona45##',
     database: 'client-database-mig'
};

class ExpenseDataMigrator {
     constructor() {
          this.connection = null;
          this.migratedCount = 0;
          this.errors = [];
     }

     async connect() {
          console.log('🔌 Connecting to database...');
          try {
               this.connection = await mysql.createConnection(dbConfig);
               console.log('✅ Connected to migrated database (client-database-mig)');
          } catch (error) {
               console.error('❌ Error connecting to database:', error);
               throw error;
          }
     }

     async disconnect() {
          if (this.connection) await this.connection.end();
          console.log('🔌 Disconnected from database');
     }

     async getApprovedExpenses() {
          console.log('📊 Fetching approved expenses from database...');

          const query = `
            SELECT
                er.*,
                em.name as merchant_name,
                em.email as merchant_email,
                em.phone as merchant_phone,
                em.address as merchant_address
            FROM expensesrecord er
            LEFT JOIN expense_merchants em ON er.merchant = em.name
            WHERE er.approved = 1
            ORDER BY er.employeeid, er.date
        `;

          const [rows] = await this.connection.execute(query);
          console.log(`📊 Found ${rows.length} approved expenses to migrate`);

          return rows;
     }

     async getOrCreateMerchant(merchantName, merchantData = {}) {
          if (!merchantName || merchantName.trim() === '') {
               return null;
          }

          // First, try to find existing merchant
          const findQuery = 'SELECT id FROM expense_merchants WHERE name = ?';
          const [existing] = await this.connection.execute(findQuery, [merchantName]);

          if (existing.length > 0) {
               return existing[0].id;
          }

          // Create new merchant if not found
          const insertQuery = `
            INSERT INTO expense_merchants (name, email, phone, address, created_by, updated_by)
            VALUES (?, ?, ?, ?, 1, 1)
        `;

          const values = [
               merchantName,
               merchantData.email || null,
               merchantData.phone || null,
               merchantData.address || null
          ];

          const [result] = await this.connection.execute(insertQuery, values);
          console.log(`🏪 Created new merchant: ${merchantName} (ID: ${result.insertId})`);

          return result.insertId;
     }

     async createInvoiceForExpense(expense, merchantId) {
          const invoiceNumber = `MIG-${expense.id}-${Date.now()}`;
          const invoiceDate = expense.approvedon || expense.date || new Date().toISOString().split('T')[0];
          const dueDate = new Date(invoiceDate);
          dueDate.setDate(dueDate.getDate() + 30); // 30 days payment term

          console.log(`📅 Using approval date for invoice: ${invoiceDate} (approvedon: ${expense.approvedon}, date: ${expense.date})`);

          const insertQuery = `
            INSERT INTO invoices (
                invoice_number, invoice_date, due_date, merchant_id,
                employee_id, branch_id, total_amount, tax_amount, status, created_on
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Paid', NOW())
        `;

          const values = [
               invoiceNumber,
               invoiceDate,
               dueDate.toISOString().split('T')[0],
               merchantId,
               expense.employeeid,
               expense.branchid,
               parseFloat(expense.amount),
               0.00 // No tax for migrated expenses
          ];

          const [result] = await this.connection.execute(insertQuery, values);
          const invoiceId = result.insertId;

          console.log(`📄 Created invoice ${invoiceNumber} for expense ${expense.id}`);

          return { invoiceId, invoiceNumber };
     }

     async linkExpenseToInvoice(invoiceId, expenseId) {
          const insertQuery = `
            INSERT INTO invoice_expenses (invoice_id, expense_id)
            VALUES (?, ?)
        `;

          await this.connection.execute(insertQuery, [invoiceId, expenseId]);
          console.log(`🔗 Linked expense ${expenseId} to invoice ${invoiceId}`);
     }

     async createPaymentForExpense(expense, invoiceId) {
          const paymentDate = expense.approvedon || expense.date || new Date().toISOString().split('T')[0];

          console.log(`💰 Using approval date for payment: ${paymentDate} (approvedon: ${expense.approvedon}, date: ${expense.date})`);

          const insertQuery = `
            INSERT INTO expense_payments (
                expense_id, invoice_id, payment_date, amount,
                method, status, created_by, created_on
            ) VALUES (?, ?, ?, ?, 'Cash', 'Paid', ?, NOW())
        `;

          const values = [
               expense.id,
               invoiceId,
               paymentDate,
               parseFloat(expense.amount),
               expense.employeeid
          ];

          const [result] = await this.connection.execute(insertQuery, values);
          console.log(`💰 Created payment for expense ${expense.id}, amount: ${expense.amount}`);

          return result.insertId;
     }

     async migrateExpense(expense) {
          try {
               console.log(`\n🔄 Migrating expense ID: ${expense.id}, Amount: ${expense.amount}, Merchant: ${expense.merchant}`);

               // Get or create merchant
               const merchantId = await this.getOrCreateMerchant(expense.merchant, {
                    email: expense.merchant_email,
                    phone: expense.merchant_phone,
                    address: expense.merchant_address
               });

               if (!merchantId) {
                    throw new Error(`Could not create/find merchant for expense ${expense.id}`);
               }

               // Create invoice
               const { invoiceId } = await this.createInvoiceForExpense(expense, merchantId);

               // Link expense to invoice
               await this.linkExpenseToInvoice(invoiceId, expense.id);

               // Create payment
               await this.createPaymentForExpense(expense, invoiceId);

               this.migratedCount++;
               console.log(`✅ Successfully migrated expense ${expense.id}`);

          } catch (error) {
               console.error(`❌ Failed to migrate expense ${expense.id}:`, error.message);
               this.errors.push({
                    expenseId: expense.id,
                    error: error.message,
                    expense: expense
               });
          }
     }

     async runMigration() {
          console.log('🚀 Starting Expense Data Migration');
          console.log('=====================================');

          const startTime = new Date();
          console.log(`Start time: ${startTime.toISOString()}`);

          try {
               await this.connect();

               // Get all approved expenses
               const expenses = await this.getApprovedExpenses();

               if (expenses.length === 0) {
                    console.log('⚠️  No approved expenses found to migrate');
                    return;
               }

               console.log(`\n📋 Starting migration of ${expenses.length} expenses...`);

               // Process each expense
               for (const expense of expenses) {
                    await this.migrateExpense(expense);

                    // Progress indicator
                    if (this.migratedCount % 10 === 0) {
                         console.log(`📊 Progress: ${this.migratedCount}/${expenses.length} expenses migrated`);
                    }
               }

               // Final summary
               const endTime = new Date();
               const duration = (endTime - startTime) / 1000;

               console.log('\n🎉 Migration completed!');
               console.log('======================');
               console.log(`✅ Successfully migrated: ${this.migratedCount} expenses`);
               console.log(`❌ Failed migrations: ${this.errors.length}`);
               console.log(`⏱️  Total time: ${duration} seconds`);
               console.log(`📅 End time: ${endTime.toISOString()}`);

               if (this.errors.length > 0) {
                    console.log('\n❌ Migration Errors:');
                    this.errors.forEach((err, index) => {
                         console.log(`${index + 1}. Expense ${err.expenseId}: ${err.error}`);
                    });

                    // Save errors to file
                    const errorFile = path.join(__dirname, 'migration-errors.json');
                    fs.writeFileSync(errorFile, JSON.stringify(this.errors, null, 2));
                    console.log(`💾 Error details saved to: ${errorFile}`);
               }

          } catch (error) {
               console.error('💥 Migration failed with error:', error);
               throw error;
          } finally {
               await this.disconnect();
          }
     }
}

// Run the migration
if (require.main === module) {
     const migrator = new ExpenseDataMigrator();
     migrator.runMigration()
          .then(() => {
               console.log('\n🏁 Migration process finished');
               process.exit(0);
          })
          .catch((error) => {
               console.error('\n💥 Migration process failed:', error);
               process.exit(1);
          });
}

module.exports = ExpenseDataMigrator;
