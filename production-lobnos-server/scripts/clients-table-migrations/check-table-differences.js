const mysql = require('mysql2/promise');

// Database configurations
const clientDbConfig = {
     host: 'localhost',
     user: 'primelab',
     password: 'Barcelona45##',
     database: 'client-database-mig'
};

const limsDbConfig = {
     host: 'localhost',
     user: 'primelab',
     password: 'Barcelona45##',
     database: 'limsdb'
};

class TableDifferenceChecker {
     constructor() {
          this.clientConnection = null;
          this.limsConnection = null;
     }

     async connect() {
          console.log('Connecting to databases...');
          try {
               this.clientConnection = await mysql.createConnection(clientDbConfig);
               console.log('✓ Connected to client-database-mig');

               this.limsConnection = await mysql.createConnection(limsDbConfig);
               console.log('✓ Connected to limsdb');

               console.log('');
          } catch (error) {
               console.error('Error connecting to databases:', error);
               throw error;
          }
     }

     async disconnect() {
          if (this.clientConnection) await this.clientConnection.end();
          if (this.limsConnection) await this.limsConnection.end();
          console.log('\n✓ Disconnected from databases');
     }

     async getTables(connection, dbName) {
          const [tables] = await connection.execute("SHOW TABLES");
          return tables.map(row => Object.values(row)[0]);
     }

     async getTableStructure(connection, tableName) {
          const [columns] = await connection.execute(`DESCRIBE \`${tableName}\``);
          return columns;
     }

     async getTableRowCount(connection, tableName) {
          try {
               const [result] = await connection.execute(`SELECT COUNT(*) as count FROM \`${tableName}\``);
               return result[0].count;
          } catch (error) {
               return 'Error';
          }
     }

     async checkDifferences() {
          console.log('═══════════════════════════════════════════════════════════════');
          console.log('        TABLE DIFFERENCE ANALYSIS');
          console.log('        client-database-mig vs limsdb');
          console.log('═══════════════════════════════════════════════════════════════\n');

          // Get all tables from both databases
          const clientTables = await this.getTables(this.clientConnection, 'client-database-mig');
          const limsTables = await this.getTables(this.limsConnection, 'limsdb');

          console.log(`📊 Database Statistics:`);
          console.log(`   client-database-mig: ${clientTables.length} tables`);
          console.log(`   limsdb:              ${limsTables.length} tables\n`);

          // Find tables only in client-database-mig
          const onlyInClient = clientTables.filter(table => !limsTables.includes(table));

          // Find tables only in limsdb
          const onlyInLims = limsTables.filter(table => !clientTables.includes(table));

          // Find common tables
          const commonTables = clientTables.filter(table => limsTables.includes(table));

          // ===== TABLES ONLY IN CLIENT-DATABASE-MIG =====
          if (onlyInClient.length > 0) {
               console.log('═══════════════════════════════════════════════════════════════');
               console.log(`📋 TABLES ONLY IN client-database-mig (${onlyInClient.length})`);
               console.log('═══════════════════════════════════════════════════════════════\n');

               for (const tableName of onlyInClient.sort()) {
                    const rowCount = await this.getTableRowCount(this.clientConnection, tableName);
                    console.log(`   ➤ ${tableName} (${rowCount} rows)`);
               }
               console.log('');
          }

          // ===== TABLES ONLY IN LIMSDB =====
          if (onlyInLims.length > 0) {
               console.log('═══════════════════════════════════════════════════════════════');
               console.log(`📋 TABLES ONLY IN limsdb (${onlyInLims.length})`);
               console.log('═══════════════════════════════════════════════════════════════\n');

               for (const tableName of onlyInLims.sort()) {
                    const rowCount = await this.getTableRowCount(this.limsConnection, tableName);
                    console.log(`   ➤ ${tableName} (${rowCount} rows)`);
               }
               console.log('');
          }

          // ===== SUMMARY =====
          console.log('═══════════════════════════════════════════════════════════════');
          console.log('                          SUMMARY');
          console.log('═══════════════════════════════════════════════════════════════\n');

          console.log(`Total Tables:`);
          console.log(`   client-database-mig:      ${clientTables.length}`);
          console.log(`   limsdb:                   ${limsTables.length}\n`);

          console.log(`Differences:`);
          console.log(`   Only in client-database-mig: ${onlyInClient.length} tables`);
          console.log(`   Only in limsdb:              ${onlyInLims.length} tables`);
          console.log(`   Common tables:               ${commonTables.length} tables\n`);

          if (onlyInClient.length === 0 && onlyInLims.length === 0) {
               console.log('✅ Databases have the same tables!\n');
          } else {
               console.log('⚠️  Databases have different tables.\n');
          }

          console.log('═══════════════════════════════════════════════════════════════\n');
     }

     async generateMigrationReport() {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const reportPath = path.join(__dirname, `table-diff-report-${timestamp}.txt`);

          console.log(`📝 Generating detailed report: ${reportPath}\n`);

          // Redirect console output to file
          const originalLog = console.log;
          let reportContent = '';

          console.log = (...args) => {
               reportContent += args.join(' ') + '\n';
               originalLog(...args);
          };

          await this.checkDifferences();

          // Restore original console.log
          console.log = originalLog;

          // Write report to file
          const fs = require('fs');
          fs.writeFileSync(reportPath, reportContent);

          console.log(`✅ Report saved to: ${reportPath}\n`);
     }
}

// Main execution
async function main() {
     const checker = new TableDifferenceChecker();

     try {
          await checker.connect();
          await checker.checkDifferences();
          // Uncomment the line below to generate a report file
          // await checker.generateMigrationReport();
     } catch (error) {
          console.error('❌ Error during analysis:', error);
     } finally {
          await checker.disconnect();
     }
}

// Run the script
main().catch(console.error);
