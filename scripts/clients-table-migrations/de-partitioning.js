const mysql = require('mysql2/promise');

class DatabaseDePartitioner {
     constructor(options = {}) {
          this.options = {
               dryRun: options.dryRun || false,
               logLevel: options.logLevel || 'INFO',
               ...options
          };
          this.connection = null;
          this.startTime = null;
          this.stats = {
               tablesProcessed: 0,
               partitionsRemoved: 0,
               errors: [],
               warnings: []
          };
     }

     log(level, message, data = null) {
          const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
          const currentLevelIndex = levels.indexOf(this.options.logLevel.toUpperCase());
          const messageLevelIndex = levels.indexOf(level.toUpperCase());
          if (messageLevelIndex < currentLevelIndex) return;

          const timestamp = new Date().toISOString();
          const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

          if (data) {
               console.log(formattedMessage, data);
          } else {
               console.log(formattedMessage);
          }

          if (level.toUpperCase() === 'ERROR') {
               this.stats.errors.push({ timestamp, message, data });
          } else if (level.toUpperCase() === 'WARN') {
               this.stats.warnings.push({ timestamp, message, data });
          }
     }

     async connect(databaseName = 'client-database-mig') {
          const stepStart = new Date();
          console.log(`[${stepStart.toISOString()}] 🔌 STEP 1: Connecting to database...`);

          this.startTime = Date.now();
          this.log('INFO', '🚀 Starting Database De-Partitioning Process');

          try {
               const dbConfig = {
                    host: 'localhost',
                    user: 'primelab',
                    password: 'Barcelona45##',
                    database: databaseName,
                    connectTimeout: 60000,
                    multipleStatements: true
               };

               this.connection = await mysql.createConnection(dbConfig);
               this.log('INFO', `✅ Connected to database: ${databaseName}`);

               // Test connection
               await this.connection.execute('SELECT 1');
               this.log('INFO', '✅ Database connection verified');

               const stepEnd = new Date();
               console.log(`[${stepEnd.toISOString()}] ✅ STEP 1 COMPLETED: Database connection established (${stepEnd - stepStart}ms)`);

          } catch (error) {
               this.log('ERROR', '❌ Failed to connect to database', error.message);
               throw new Error(`Database connection failed: ${error.message}`);
          }
     }

     async disconnect() {
          try {
               if (this.connection) {
                    await this.connection.end();
                    this.log('INFO', '✅ Disconnected from database');
               }
          } catch (error) {
               this.log('WARN', '⚠️  Warning during disconnection', error.message);
          }

          const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
          this.log('INFO', `⏱️  Total execution time: ${duration} seconds`);
          this.printSummary();
     }

     async getPartitionedTables() {
          const stepStart = new Date();
          console.log(`[${stepStart.toISOString()}] 🔍 STEP 2: Scanning for partitioned tables...`);

          try {
               const query = `
                SELECT DISTINCT
                    t.TABLE_SCHEMA,
                    t.TABLE_NAME,
                    p.PARTITION_METHOD,
                    p.SUBPARTITION_METHOD,
                    COUNT(p.PARTITION_NAME) as partition_count,
                    GROUP_CONCAT(p.PARTITION_NAME ORDER BY p.PARTITION_ORDINAL_POSITION) as partition_names
                FROM information_schema.PARTITIONS p
                JOIN information_schema.TABLES t ON p.TABLE_SCHEMA = t.TABLE_SCHEMA
                    AND p.TABLE_NAME = t.TABLE_NAME
                WHERE p.TABLE_SCHEMA = DATABASE()
                    AND p.PARTITION_NAME IS NOT NULL
                GROUP BY t.TABLE_SCHEMA, t.TABLE_NAME, p.PARTITION_METHOD, p.SUBPARTITION_METHOD
                ORDER BY t.TABLE_NAME;
            `;

               const [rows] = await this.connection.execute(query);

               const partitionedTables = rows.map(row => ({
                    schema: row.TABLE_SCHEMA,
                    tableName: row.TABLE_NAME,
                    partitionMethod: row.PARTITION_METHOD,
                    subPartitionMethod: row.SUBPARTITION_METHOD,
                    partitionCount: row.partition_count,
                    partitionNames: row.partition_names ? row.partition_names.split(',') : []
               }));

               const stepEnd = new Date();
               console.log(`[${stepEnd.toISOString()}] ✅ STEP 2 COMPLETED: Found ${partitionedTables.length} partitioned tables (${stepEnd - stepStart}ms)`);

               this.log('INFO', `📋 Found ${partitionedTables.length} partitioned tables`);
               return partitionedTables;

          } catch (error) {
               this.log('ERROR', 'Failed to get partitioned tables', error.message);
               throw error;
          }
     }

     async removePartitioning(tableName) {
          try {
               this.log('INFO', `🔄 Starting de-partitioning for table: ${tableName}`);

               if (this.options.dryRun) {
                    this.log('INFO', `🔍 DRY RUN: Would remove partitioning from ${tableName}`);
                    return true;
               }

               // Get partition information before removal
               const [partitionInfo] = await this.connection.execute(`
                SELECT PARTITION_METHOD, SUBPARTITION_METHOD, COUNT(*) as partition_count
                FROM information_schema.PARTITIONS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = ?
                AND PARTITION_NAME IS NOT NULL
                GROUP BY PARTITION_METHOD, SUBPARTITION_METHOD
            `, [tableName]);

               if (partitionInfo.length === 0) {
                    this.log('WARN', `⚠️  Table ${tableName} is not partitioned`);
                    return false;
               }

               const partitionMethod = partitionInfo[0].PARTITION_METHOD;
               const subPartitionMethod = partitionInfo[0].SUBPARTITION_METHOD;
               const partitionCount = partitionInfo[0].partition_count;

               this.log('INFO', `📊 Table ${tableName}: ${partitionMethod} partitioning with ${partitionCount} partitions`);

               // Check for any locks or ongoing operations
               const [lockInfo] = await this.connection.execute(`
                SELECT * FROM information_schema.INNODB_LOCKS
                WHERE LOCK_TABLE = ?
            `, [`client-database-mig.${tableName}`]);

               if (lockInfo.length > 0) {
                    this.log('WARN', `⚠️  Table ${tableName} has active locks - de-partitioning may be blocked`);
               }

               // Execute the de-partitioning
               const alterSql = `ALTER TABLE \`${tableName}\` REMOVE PARTITIONING`;
               this.log('DEBUG', `Executing: ${alterSql}`);

               await this.connection.execute(alterSql);

               this.log('INFO', `✅ Successfully removed partitioning from ${tableName}`);

               // Verify the de-partitioning
               const [verifyResult] = await this.connection.execute(`
                SELECT COUNT(*) as remaining_partitions
                FROM information_schema.PARTITIONS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = ?
                AND PARTITION_NAME IS NOT NULL
            `, [tableName]);

               const remainingPartitions = verifyResult[0].remaining_partitions;

               if (remainingPartitions === 0) {
                    this.log('INFO', `✅ Verification: All partitions removed from ${tableName}`);
                    return true;
               } else {
                    this.log('ERROR', `❌ Verification failed: ${remainingPartitions} partitions still exist in ${tableName}`);
                    return false;
               }

          } catch (error) {
               this.log('ERROR', `❌ Failed to remove partitioning from ${tableName}`, error.message);

               // Check for specific MySQL errors
               if (error.code === 'ER_LOCK_WAIT_TIMEOUT') {
                    this.log('ERROR', 'Lock wait timeout - table may be in use by other operations');
               } else if (error.code === 'ER_TABLE_NOT_LOCKED') {
                    this.log('ERROR', 'Table locking issue - may need to retry');
               }

               throw error;
          }
     }

     async dePartitionDatabase() {
          const stepStart = new Date();
          console.log(`[${stepStart.toISOString()}] 🔧 STEP 3: Starting de-partitioning process...`);

          try {
               this.log('INFO', '🔧 Starting database de-partitioning process');

               if (this.options.dryRun) {
                    this.log('INFO', '🔍 DRY RUN MODE: No actual changes will be made');
               }

               // Get all partitioned tables
               const partitionedTables = await this.getPartitionedTables();

               if (partitionedTables.length === 0) {
                    this.log('INFO', '✅ No partitioned tables found - database is already de-partitioned');
                    const stepEnd = new Date();
                    console.log(`[${stepEnd.toISOString()}] ✅ STEP 3 COMPLETED: No partitioned tables to process (${stepEnd - stepStart}ms)`);
                    return;
               }

               const processingStart = new Date();
               console.log(`[${processingStart.toISOString()}] 🔄 STEP 4: Processing ${partitionedTables.length} partitioned tables...`);

               this.log('INFO', `🎯 Processing ${partitionedTables.length} partitioned tables`);

               let successCount = 0;
               let failureCount = 0;

               for (const tableInfo of partitionedTables) {
                    const tableStart = new Date();
                    console.log(`[${tableStart.toISOString()}] 📊 Processing table '${tableInfo.tableName}'...`);

                    try {
                         this.log('INFO', `📊 Processing table '${tableInfo.tableName}' (${tableInfo.partitionMethod} partitioning, ${tableInfo.partitionCount} partitions)`);

                         const success = await this.removePartitioning(tableInfo.tableName);

                         if (success) {
                              successCount++;
                              this.stats.partitionsRemoved += tableInfo.partitionCount;
                              this.stats.tablesProcessed++;
                              this.log('INFO', `✅ Table '${tableInfo.tableName}' de-partitioned successfully`);
                              console.log(`[${new Date().toISOString()}] ✅ Table '${tableInfo.tableName}' completed (${new Date() - tableStart}ms)`);
                         } else {
                              failureCount++;
                              this.log('ERROR', `❌ Failed to de-partition table '${tableInfo.tableName}'`);
                              console.log(`[${new Date().toISOString()}] ❌ Table '${tableInfo.tableName}' failed (${new Date() - tableStart}ms)`);
                         }

                    } catch (tableError) {
                         failureCount++;
                         const tableEnd = new Date();
                         this.log('ERROR', `Failed to process table '${tableInfo.tableName}': ${tableError.message}`);
                         console.log(`[${tableEnd.toISOString()}] ❌ Table '${tableInfo.tableName}' error (${tableEnd - tableStart}ms)`);
                    }
               }

               const processingEnd = new Date();
               console.log(`[${processingEnd.toISOString()}] ✅ STEP 4 COMPLETED: ${successCount} successful, ${failureCount} failed (${processingEnd - processingStart}ms)`);

               this.log('INFO', `🎉 De-partitioning completed: ${successCount} successful, ${failureCount} failed`);

               if (failureCount > 0) {
                    this.log('WARN', `⚠️  ${failureCount} tables failed de-partitioning - check logs for details`);
               }

               const stepEnd = new Date();
               console.log(`[${stepEnd.toISOString()}] ✅ STEP 3 COMPLETED: De-partitioning process finished (${stepEnd - stepStart}ms)`);

          } catch (error) {
               const stepEnd = new Date();
               console.log(`[${stepEnd.toISOString()}] ❌ STEP 3 FAILED: De-partitioning process error (${stepEnd - stepStart}ms)`);
               this.log('ERROR', '❌ Database de-partitioning failed catastrophically', error.message);
               throw error;
          }
     }

     async verifyDePartitioning() {
          try {
               this.log('INFO', '🔍 Verifying de-partitioning results');

               const [partitionCheck] = await this.connection.execute(`
                SELECT COUNT(*) as remaining_partitioned_tables
                FROM information_schema.PARTITIONS
                WHERE TABLE_SCHEMA = DATABASE()
                AND PARTITION_NAME IS NOT NULL
            `);

               const remainingPartitionedTables = partitionCheck[0].remaining_partitioned_tables;

               if (remainingPartitionedTables === 0) {
                    this.log('INFO', '✅ Verification successful: No partitioned tables remain');
                    return true;
               } else {
                    this.log('WARN', `⚠️  Verification: ${remainingPartitionedTables} partitioned tables still exist`);

                    // List remaining partitioned tables
                    const [remainingTables] = await this.connection.execute(`
                    SELECT DISTINCT TABLE_NAME, PARTITION_METHOD, COUNT(PARTITION_NAME) as partition_count
                    FROM information_schema.PARTITIONS
                    WHERE TABLE_SCHEMA = DATABASE()
                    AND PARTITION_NAME IS NOT NULL
                    GROUP BY TABLE_NAME, PARTITION_METHOD
                `);

                    remainingTables.forEach(table => {
                         this.log('WARN', `   - ${table.TABLE_NAME} (${table.PARTITION_METHOD}, ${table.partition_count} partitions)`);
                    });

                    return false;
               }

          } catch (error) {
               this.log('ERROR', '❌ Error during verification', error.message);
               return false;
          }
     }

     printSummary() {
          console.log('\n' + '='.repeat(60));
          console.log('📊 DATABASE DE-PARTITIONING SUMMARY');
          console.log('='.repeat(60));
          console.log(`⏱️  Execution Time: ${((Date.now() - this.startTime) / 1000).toFixed(2)} seconds`);
          console.log(`📋 Tables Processed: ${this.stats.tablesProcessed}`);
          console.log(`🗂️  Partitions Removed: ${this.stats.partitionsRemoved}`);
          console.log(`⚠️  Warnings: ${this.stats.warnings.length}`);
          console.log(`❌ Errors: ${this.stats.errors.length}`);

          if (this.options.dryRun) {
               console.log('🔍 Mode: DRY RUN (no changes made)');
          } else {
               console.log('🔧 Mode: LIVE (changes applied)');
          }

          if (this.stats.errors.length > 0) {
               console.log('\n❌ ERRORS ENCOUNTERED:');
               this.stats.errors.forEach((error, index) => {
                    console.log(`   ${index + 1}. ${error.message}`);
               });
          }

          if (this.stats.warnings.length > 0) {
               console.log('\n⚠️  WARNINGS:');
               this.stats.warnings.forEach((warning, index) => {
                    console.log(`   ${index + 1}. ${warning.message}`);
               });
          }

          console.log('='.repeat(60));
     }

     async run() {
          try {
               await this.connect();
               await this.dePartitionDatabase();

               if (!this.options.dryRun) {
                    const verifyStart = new Date();
                    console.log(`[${verifyStart.toISOString()}] 🔍 STEP 5: Verifying de-partitioning results...`);
                    await this.verifyDePartitioning();
                    const verifyEnd = new Date();
                    console.log(`[${verifyEnd.toISOString()}] ✅ STEP 5 COMPLETED: Verification finished (${verifyEnd - verifyStart}ms)`);
               }

               const finalEnd = new Date();
               console.log(`[${finalEnd.toISOString()}] 🎉 ALL STEPS COMPLETED: Database de-partitioning finished successfully!`);
               this.log('INFO', '🎉 Database de-partitioning completed successfully!');

          } catch (error) {
               const errorTime = new Date();
               console.log(`[${errorTime.toISOString()}] 💥 PROCESS FAILED: Database de-partitioning error`);
               this.log('ERROR', '💥 Database de-partitioning failed', error.message);
               process.exitCode = 1;
          } finally {
               await this.disconnect();
          }
     }
}

// CLI interface
if (require.main === module) {
     const args = process.argv.slice(2);
     const options = {};

     if (args.includes('--dry-run')) {
          options.dryRun = true;
     }
     if (args.includes('--debug')) {
          options.logLevel = 'DEBUG';
     }
     if (args.includes('--quiet')) {
          options.logLevel = 'ERROR';
     }

     const dePartitioner = new DatabaseDePartitioner(options);
     console.log('🚀 Lobnos Database De-Partitioner v1.0');
     console.log('=====================================');
     if (options.dryRun) {
          console.log('🔍 DRY RUN MODE - Previewing changes without applying them');
     }
     console.log('');
     dePartitioner.run().catch(console.error);
}

module.exports = DatabaseDePartitioner;