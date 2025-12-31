const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Database configuration (migrated database with new schema)
const dbConfig = {
     host: 'localhost',
     user: 'primelab',
     password: 'Barcelona45##',
     database: 'client-database-mig'
};

class DBOServicesDataMigrator {
     constructor() {
          this.connection = null;
          this.updatedServices = 0;
          this.updatedBillings = 0;
          this.errors = [];
          this.warnings = [];
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

     async getAllBillingIds() {
          console.log('📊 Fetching all billing IDs from database...');

          const query = `
            SELECT DISTINCT billingid
            FROM billing
            ORDER BY billingid
        `;

          const [rows] = await this.connection.execute(query);
          console.log(`📊 Found ${rows.length} billing IDs to process`);

          return rows.map(row => row.billingid);
     }

     async getServicesForBilling(billingId) {
          const query = `
            SELECT
                serviceid, billingid, trackId, cost, totalcost, totalpayable,
                paidamount, paymentstatus, outstanding, outsourceprice,
                isoutsourced, outsourceid, categoryTrackId
            FROM dboservices
            WHERE billingid = ?
            ORDER BY serviceid
        `;

          const [rows] = await this.connection.execute(query, [billingId]);
          return rows;
     }

     async getBillingInfo(billingId) {
          const query = `
            SELECT
                billingid, paid, payable, outstanding, status,
                totalcost, totalTransactionCost
            FROM billing
            WHERE billingid = ?
        `;

          const [rows] = await this.connection.execute(query, [billingId]);
          return rows[0] || null;
     }

     async updateOutsourcePrice(serviceId, outsourcePrice) {
          const updateQuery = `
            UPDATE dboservices
            SET outsourceprice = ?
            WHERE serviceid = ?
        `;

          await this.connection.execute(updateQuery, [outsourcePrice, serviceId]);
     }

     async updateServicePaymentFields(serviceId, paidAmount, paymentStatus, outstanding) {
          const updateQuery = `
            UPDATE dboservices
            SET paidamount = ?, paymentstatus = ?, outstanding = ?
            WHERE serviceid = ?
        `;

          await this.connection.execute(updateQuery, [paidAmount, paymentStatus, outstanding, serviceId]);
     }

     async updateBillingPaidAmount(billingId, totalPaidAmount) {
          const updateQuery = `
            UPDATE billing
            SET paid = ?
            WHERE billingid = ?
        `;

          await this.connection.execute(updateQuery, [totalPaidAmount, billingId]);
     }

     async getOutsourcePrice(outsourceId, generalTestId) {
          const query = `
            SELECT outsourcePrice
            FROM outsourceorganizationservices
            WHERE outsourceid = ? AND generalTestId = ?
        `;

          const [rows] = await this.connection.execute(query, [outsourceId, generalTestId]);
          return rows[0]?.outsourcePrice || null;
     }

     async updateOutsourcePricesForBilling(billingId, services) {
          let updatedCount = 0;

          for (const service of services) {
               if (service.isoutsourced && service.outsourceid && service.trackId) {
                    const outsourcePrice = await this.getOutsourcePrice(service.outsourceid, service.trackId);

                    if (outsourcePrice !== null && outsourcePrice !== service.outsourceprice) {
                         await this.updateOutsourcePrice(service.serviceid, outsourcePrice);
                         updatedCount++;
                         console.log(`   💰 Updated outsource price for service ${service.serviceid}: ${service.outsourceprice} → ${outsourcePrice}`);
                    }
               }
          }

          return updatedCount;
     }

     calculatePaymentDistribution(services, totalBillingPaid) {
          const totalPayable = services.reduce((sum, service) => sum + parseFloat(service.totalpayable || 0), 0);

          if (totalPayable === 0) {
               // If no payable amount, distribute equally or set to zero
               return services.map(service => ({
                    ...service,
                    calculatedPaidAmount: 0,
                    calculatedPaymentStatus: 'pending',
                    calculatedOutstanding: parseFloat(service.totalpayable || 0)
               }));
          }

          let remainingPayment = totalBillingPaid;
          const updatedServices = [];

          // Sort services by totalpayable (process smaller amounts first for better distribution)
          const sortedServices = [...services].sort((a, b) =>
               parseFloat(a.totalpayable || 0) - parseFloat(b.totalpayable || 0)
          );

          for (const service of sortedServices) {
               const payable = parseFloat(service.totalpayable || 0);
               let paidAmount = 0;
               let paymentStatus = 'pending';
               let outstanding = payable;

               if (remainingPayment > 0) {
                    if (remainingPayment >= payable) {
                         paidAmount = payable;
                         paymentStatus = 'paid';
                         outstanding = 0;
                         remainingPayment -= payable;
                    } else {
                         paidAmount = remainingPayment;
                         paymentStatus = 'partial';
                         outstanding = payable - remainingPayment;
                         remainingPayment = 0;
                    }
               }

               updatedServices.push({
                    ...service,
                    calculatedPaidAmount: paidAmount,
                    calculatedPaymentStatus: paymentStatus,
                    calculatedOutstanding: outstanding
               });
          }

          return updatedServices;
     }

     async updateServicePaymentConsistency(billingId, billingInfo, services) {
          const billingStatus = billingInfo.status;
          const billingPaid = parseFloat(billingInfo.paid || 0);
          let updatedCount = 0;

          // Calculate distributed payments
          const updatedServices = this.calculatePaymentDistribution(services, billingPaid);

          // Apply updates based on billing status
          for (const service of updatedServices) {
               let finalPaymentStatus = service.calculatedPaymentStatus;
               let finalPaidAmount = service.calculatedPaidAmount;
               let finalOutstanding = service.calculatedOutstanding;

               // Override based on billing status if needed
               if (billingStatus === 'paid') {
                    finalPaymentStatus = 'paid';
                    finalPaidAmount = parseFloat(service.totalpayable || 0);
                    finalOutstanding = 0;
               } else if (billingStatus === 'pending') {
                    finalPaymentStatus = 'pending';
                    finalPaidAmount = 0;
                    finalOutstanding = parseFloat(service.totalpayable || 0);
               }

               // Check if update is needed
               const currentPaidAmount = parseFloat(service.paidamount || 0);
               const currentOutstanding = parseFloat(service.outstanding || 0);

               if (currentPaidAmount !== finalPaidAmount ||
                    service.paymentstatus !== finalPaymentStatus ||
                    currentOutstanding !== finalOutstanding) {

                    await this.updateServicePaymentFields(
                         service.serviceid,
                         finalPaidAmount,
                         finalPaymentStatus,
                         finalOutstanding
                    );
                    updatedCount++;
                    console.log(`   💳 Updated service ${service.serviceid}: paid ${currentPaidAmount}→${finalPaidAmount}, status ${service.paymentstatus}→${finalPaymentStatus}`);
               }
          }

          return updatedCount;
     }

     async validateBillingServiceConsistency(billingId, billingInfo, services) {
          const billingPaid = parseFloat(billingInfo.paid || 0);
          const servicesTotalPaid = services.reduce((sum, service) =>
               sum + parseFloat(service.paidamount || 0), 0);

          const difference = Math.abs(billingPaid - servicesTotalPaid);

          if (difference > 0.01) { // Allow for small floating point differences
               this.warnings.push({
                    type: 'consistency_mismatch',
                    billingId,
                    billingPaid,
                    servicesTotalPaid,
                    difference,
                    serviceCount: services.length
               });
               console.log(`   ⚠️  Consistency warning for billing ${billingId}: billing paid ${billingPaid}, services total ${servicesTotalPaid} (diff: ${difference})`);
          }
     }

     async processBilling(billingId) {
          try {
               console.log(`\n🔄 Processing billing ID: ${billingId}`);

               // Get billing info
               const billingInfo = await this.getBillingInfo(billingId);
               if (!billingInfo) {
                    throw new Error(`Billing ${billingId} not found`);
               }

               // Get all services for this billing
               const services = await this.getServicesForBilling(billingId);
               console.log(`   📋 Found ${services.length} services for billing ${billingId}`);

               if (services.length === 0) {
                    console.log(`   ⚠️  No services found for billing ${billingId}, skipping`);
                    return;
               }

               // Step 1: Update outsource prices
               const outsourceUpdates = await this.updateOutsourcePricesForBilling(billingId, services);

               // Step 2: Update payment consistency
               const paymentUpdates = await this.updateServicePaymentConsistency(billingId, billingInfo, services);

               // Step 3: Validate consistency
               await this.validateBillingServiceConsistency(billingId, billingInfo, services);

               this.updatedServices += (outsourceUpdates + paymentUpdates);
               this.updatedBillings++;

               console.log(`✅ Completed billing ${billingId}: ${outsourceUpdates} outsource price updates, ${paymentUpdates} payment updates`);

          } catch (error) {
               console.error(`❌ Failed to process billing ${billingId}:`, error.message);
               this.errors.push({
                    billingId,
                    error: error.message,
                    stack: error.stack
               });
          }
     }

     async runMigration() {
          console.log('🚀 Starting DBO Services Data Migration');
          console.log('=======================================');

          const startTime = new Date();
          console.log(`Start time: ${startTime.toISOString()}`);

          try {
               await this.connect();

               // Get all billing IDs
               const billingIds = await this.getAllBillingIds();

               if (billingIds.length === 0) {
                    console.log('⚠️  No billing IDs found to process');
                    return;
               }

               console.log(`\n📋 Starting migration of ${billingIds.length} billing records...`);

               // Process each billing ID
               for (let i = 0; i < billingIds.length; i++) {
                    const billingId = billingIds[i];
                    await this.processBilling(billingId);

                    // Progress indicator
                    if ((i + 1) % 50 === 0) {
                         console.log(`📊 Progress: ${i + 1}/${billingIds.length} billing records processed`);
                    }
               }

               // Final summary
               const endTime = new Date();
               const duration = (endTime - startTime) / 1000;

               console.log('\n🎉 Migration completed!');
               console.log('========================');
               console.log(`✅ Successfully processed: ${this.updatedBillings} billing records`);
               console.log(`🔄 Updated services: ${this.updatedServices}`);
               console.log(`⚠️  Warnings: ${this.warnings.length}`);
               console.log(`❌ Errors: ${this.errors.length}`);
               console.log(`⏱️  Total time: ${duration} seconds`);
               console.log(`📅 End time: ${endTime.toISOString()}`);

               // Save warnings and errors
               if (this.warnings.length > 0) {
                    const warningFile = path.join(__dirname, 'migration-warnings.json');
                    fs.writeFileSync(warningFile, JSON.stringify(this.warnings, null, 2));
                    console.log(`💾 Warnings saved to: ${warningFile}`);
               }

               if (this.errors.length > 0) {
                    const errorFile = path.join(__dirname, 'migration-errors.json');
                    fs.writeFileSync(errorFile, JSON.stringify(this.errors, null, 2));
                    console.log(`💾 Errors saved to: ${errorFile}`);
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
     const migrator = new DBOServicesDataMigrator();
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

module.exports = DBOServicesDataMigrator;
