const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Database configurations
const oldDbConfig = {
     host: 'localhost',
     user: 'primelab',
     password: 'Barcelona45##',
     database: 'client-database-mig'
};

const newDbConfig = {
     host: 'localhost',
     user: 'primelab',
     password: 'Barcelona45##',
     database: 'system-database-mig'
}; class DatabaseMigrator {
     constructor() {
          this.oldConnection = null;
          this.newConnection = null;
          this.oldDdlConnection = null;
          this.newDdlConnection = null;
     }

     async connect() {
          console.log('Connecting to databases...');
          try {
               this.oldConnection = await mysql.createConnection(oldDbConfig);
               console.log('Connected to old database');
               this.newConnection = await mysql.createConnection(newDbConfig);
               console.log('Connected to new database');

               // Create separate connections for DDL queries without prepared statements
               this.oldDdlConnection = await mysql.createConnection({ ...oldDbConfig, prepare: false });
               this.newDdlConnection = await mysql.createConnection({ ...newDbConfig, prepare: false });
               console.log('Connected to DDL connections');

               console.log('Connected to both databases successfully');
          } catch (error) {
               console.error('Error connecting to databases:', error);
               throw error;
          }
     }

     async disconnect() {
          if (this.oldConnection) await this.oldConnection.end();
          if (this.newConnection) await this.newConnection.end();
          if (this.oldDdlConnection) await this.oldDdlConnection.end();
          if (this.newDdlConnection) await this.newDdlConnection.end();
          console.log('Disconnected from databases');
     }

     async deleteAbsoluteDatabaseTables() {
          console.log('Analyzing tables for selective deletion...');

          const oldConnection = await mysql.createConnection({
               ...oldDbConfig,
               multipleStatements: true
          });

          const newConnection = await mysql.createConnection({
               ...newDbConfig,
               multipleStatements: true
          });

          try {
               // Get all tables from old database
               const [oldTables] = await oldConnection.execute("SHOW TABLES");
               const oldTableNames = oldTables.map(row => Object.values(row)[0]);

               // Get all tables from new database
               const [newTables] = await newConnection.execute("SHOW TABLES");
               const newTableNames = newTables.map(row => Object.values(row)[0]);

               console.log(`Old database has ${oldTableNames.length} tables`);
               console.log(`New database has ${newTableNames.length} tables`);

               // Find tables that exist in old database but NOT in new database
               const tablesToDelete = oldTableNames.filter(tableName => !newTableNames.includes(tableName));

               if (tablesToDelete.length === 0) {
                    console.log('No tables to delete - all old tables exist in new database');
                    return;
               }

               console.log(`Found ${tablesToDelete.length} tables to delete (not in new database):`);
               tablesToDelete.forEach(table => console.log(`  - ${table}`));

               // Disable foreign key checks temporarily
               await oldConnection.execute("SET FOREIGN_KEY_CHECKS = 0");

               // Drop only the tables that don't exist in new database
               let deletedCount = 0;
               for (const tableName of tablesToDelete) {
                    try {
                         await oldConnection.execute(`DROP TABLE \`${tableName}\``);
                         console.log(`Dropped table: ${tableName}`);
                         deletedCount++;
                    } catch (error) {
                         console.warn(`Failed to drop table ${tableName}:`, error.message);
                    }
               }

               // Re-enable foreign key checks
               await oldConnection.execute("SET FOREIGN_KEY_CHECKS = 1");

               console.log(`Successfully deleted ${deletedCount} tables from old database`);

          } catch (error) {
               console.error('Error during selective table deletion:', error);
               throw error;
          } finally {
               await oldConnection.end();
               await newConnection.end();
          }
     }

     async getTables(connection) {
          const [rows] = await connection.execute(
               "SHOW TABLES"
          );
          return rows.map(row => Object.values(row)[0]);
     }

     async getViews(connection) {
          const [rows] = await connection.execute(
               "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'VIEW'"
          );
          return rows.map(row => row.TABLE_NAME);
     }

     async getProcedures(connection) {
          const [rows] = await connection.execute(
               "SELECT ROUTINE_NAME FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_TYPE = 'PROCEDURE'"
          );
          return rows.map(row => row.ROUTINE_NAME);
     }

     async getTriggers(connection) {
          const [rows] = await connection.execute(
               "SELECT TRIGGER_NAME FROM INFORMATION_SCHEMA.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE()"
          );
          return rows.map(row => row.TRIGGER_NAME);
     }

     async getTableStructure(connection, tableName) {
          const [columns] = await connection.execute(
               `DESCRIBE \`${tableName}\``
          );
          return columns;
     }

     async getDetailedTableStructure(connection, tableName, databaseName) {
          const [columns] = await connection.execute(`
            SELECT
                COLUMN_NAME,
                COLUMN_TYPE,
                IS_NULLABLE,
                COLUMN_DEFAULT,
                EXTRA,
                COLUMN_KEY,
                DATA_TYPE,
                CHARACTER_MAXIMUM_LENGTH,
                NUMERIC_PRECISION,
                NUMERIC_SCALE,
                CHARACTER_SET_NAME,
                COLLATION_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = ?
            AND TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION
        `, [databaseName, tableName]);
          return columns;
     }

     async getTableIndexes(connection, tableName, databaseName) {
          const [indexes] = await connection.execute(`
            SELECT
                INDEX_NAME,
                COLUMN_NAME,
                NON_UNIQUE,
                SEQ_IN_INDEX
            FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = ?
            AND TABLE_NAME = ?
            ORDER BY INDEX_NAME, SEQ_IN_INDEX
        `, [databaseName, tableName]);
          return indexes;
     }

     async getTableConstraints(connection, tableName, databaseName) {
          // Get foreign key constraints
          const [foreignKeys] = await connection.execute(`
            SELECT
                CONSTRAINT_NAME,
                COLUMN_NAME,
                REFERENCED_TABLE_NAME,
                REFERENCED_COLUMN_NAME
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = ?
            AND TABLE_NAME = ?
            AND REFERENCED_TABLE_NAME IS NOT NULL
        `, [databaseName, tableName]);

          // Get unique constraints
          const [uniqueConstraints] = await connection.execute(`
            SELECT
                INDEX_NAME,
                COLUMN_NAME,
                SEQ_IN_INDEX
            FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = ?
            AND TABLE_NAME = ?
            AND NON_UNIQUE = 0
            AND INDEX_NAME != 'PRIMARY'
            ORDER BY INDEX_NAME, SEQ_IN_INDEX
        `, [databaseName, tableName]);

          // Get check constraints (MySQL 8.0+)
          let checkConstraints = [];
          try {
               const [checks] = await connection.execute(`
                SELECT
                    CONSTRAINT_NAME,
                    CHECK_CLAUSE
                FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS
                WHERE CONSTRAINT_SCHEMA = ?
                AND TABLE_NAME = ?
            `, [databaseName, tableName]);
               checkConstraints = checks;
          } catch (error) {
               // Check constraints not supported in this MySQL version
               console.log(`Note: Check constraints not available in this MySQL version for table ${tableName}`);
          }

          return {
               foreignKeys,
               uniqueConstraints,
               checkConstraints
          };
     }

     async createTableInOldDb(tableName) {
          console.log(`\n📝 Creating table '${tableName}' in old database...`);

          // Get detailed structure from new database
          const newStructure = await this.getDetailedTableStructure(this.newConnection, tableName, newDbConfig.database);
          const newConstraints = await this.getTableConstraints(this.newConnection, tableName, newDbConfig.database);

          // Generate CREATE TABLE statement
          let createSql = `CREATE TABLE \`${tableName}\` (`;

          const columnDefs = [];
          for (const col of newStructure) {
               let colDef = `\`${col.COLUMN_NAME}\` ${col.COLUMN_TYPE}`;

               if (col.IS_NULLABLE === 'NO') {
                    colDef += ' NOT NULL';
               }

               // Handle defaults carefully, especially for timestamp columns
               if (col.COLUMN_DEFAULT !== null) {
                    if (col.DATA_TYPE === 'timestamp') {
                         // For timestamp columns, handle special defaults
                         if (col.COLUMN_DEFAULT === 'CURRENT_TIMESTAMP') {
                              colDef += ` DEFAULT CURRENT_TIMESTAMP`;
                         } else if (col.COLUMN_DEFAULT === 'current_timestamp()') {
                              colDef += ` DEFAULT current_timestamp()`;
                         } else if (col.COLUMN_DEFAULT === '0000-00-00 00:00:00') {
                              // Skip invalid timestamp defaults
                         } else {
                              // For other timestamp defaults, don't add DEFAULT NULL
                         }
                    } else if (col.DATA_TYPE === 'varchar' || col.DATA_TYPE === 'text' || col.DATA_TYPE === 'char' || col.DATA_TYPE === 'enum') {
                         // Remove surrounding quotes if they exist, then add them back
                         let defaultValue = col.COLUMN_DEFAULT;
                         if (defaultValue.startsWith("'") && defaultValue.endsWith("'")) {
                              defaultValue = defaultValue.slice(1, -1);
                         }
                         colDef += ` DEFAULT '${defaultValue.replace(/'/g, "\\'")}'`;
                    } else {
                         colDef += ` DEFAULT ${col.COLUMN_DEFAULT}`;
                    }
               } else if (col.DATA_TYPE === 'timestamp') {
                    // For timestamp columns, don't add DEFAULT NULL as it's invalid in MySQL
                    // Just leave the column as nullable timestamp without explicit default
               }

               if (col.EXTRA) {
                    colDef += ` ${col.EXTRA}`;
               }

               columnDefs.push(colDef);
          }

          // Add primary key
          const pkColumns = newStructure.filter(col => col.COLUMN_KEY === 'PRI').map(col => `\`${col.COLUMN_NAME}\``);
          if (pkColumns.length > 0) {
               columnDefs.push(`PRIMARY KEY (${pkColumns.join(', ')})`);
          }

          // Add unique constraints
          const uniqueGroups = new Map();
          newConstraints.uniqueConstraints.forEach(u => {
               if (!uniqueGroups.has(u.INDEX_NAME)) {
                    uniqueGroups.set(u.INDEX_NAME, []);
               }
               uniqueGroups.get(u.INDEX_NAME).push(u);
          });

          for (const [indexName, columns] of uniqueGroups) {
               const sortedCols = columns.sort((a, b) => a.SEQ_IN_INDEX - b.SEQ_IN_INDEX);
               const colNames = sortedCols.map(c => `\`${c.COLUMN_NAME}\``).join(', ');
               columnDefs.push(`UNIQUE KEY \`${indexName}\` (${colNames})`);
          }

          createSql += columnDefs.join(', ') + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;';

          console.log('Generated CREATE TABLE SQL:', createSql);

          // Execute the CREATE TABLE
          await this.oldConnection.execute(createSql);

          // Add foreign key constraints
          for (const fk of newConstraints.foreignKeys) {
               const fkSql = `ALTER TABLE \`${tableName}\` ADD CONSTRAINT \`${fk.CONSTRAINT_NAME}\` FOREIGN KEY (\`${fk.COLUMN_NAME}\`) REFERENCES \`${fk.REFERENCED_TABLE_NAME}\` (\`${fk.REFERENCED_COLUMN_NAME}\`)`;
               console.log('Adding foreign key:', fkSql);
               await this.oldConnection.execute(fkSql);
          }

          // Add check constraints (if any)
          for (const check of newConstraints.checkConstraints) {
               const checkSql = `ALTER TABLE \`${tableName}\` ADD CONSTRAINT \`${check.CONSTRAINT_NAME}\` CHECK (${check.CHECK_CLAUSE})`;
               console.log('Adding check constraint:', checkSql);
               await this.oldConnection.execute(checkSql);
          }

          console.log(`✅ Table '${tableName}' created successfully in old database`);
     }

     async migrateTableStructure(tableName) {
          console.log(`\n🔄 Migrating table '${tableName}' structure...`);

          const oldStructure = await this.getDetailedTableStructure(this.oldConnection, tableName, oldDbConfig.database);
          const newStructure = await this.getDetailedTableStructure(this.newConnection, tableName, newDbConfig.database);

          const oldConstraints = await this.getTableConstraints(this.oldConnection, tableName, oldDbConfig.database);
          const newConstraints = await this.getTableConstraints(this.newConnection, tableName, newDbConfig.database);

          // Compare and migrate columns
          await this.migrateColumns(tableName, oldStructure, newStructure);

          // Compare and migrate constraints
          await this.migrateConstraints(tableName, oldConstraints, newConstraints);

          console.log(`✅ Table '${tableName}' migration completed`);
     }

     async migrateColumns(tableName, oldStructure, newStructure) {
          // Compare columns
          const oldColumns = new Map(oldStructure.map(col => [col.COLUMN_NAME, col]));
          const newColumns = new Map(newStructure.map(col => [col.COLUMN_NAME, col]));

          // Only add new columns that exist in new DB but not in old DB
          for (const [colName, newCol] of newColumns) {
               if (!oldColumns.has(colName)) {
                    console.log(`  ➕ Adding column '${colName}'`);
                    await this.addColumn(tableName, newCol);
               } else {
                    console.log(`  ⏭️  Skipping existing column '${colName}' - no modifications allowed`);
               }
          }

          // Note: Column dropping is disabled for safety
          console.log(`  ℹ️  Existing columns preserved - no modifications or deletions performed`);
     }

     async migrateConstraints(tableName, oldConstraints, newConstraints) {
          // Migrate foreign key constraints
          await this.migrateForeignKeys(tableName, oldConstraints.foreignKeys, newConstraints.foreignKeys);

          // Migrate unique constraints
          await this.migrateUniqueConstraints(tableName, oldConstraints.uniqueConstraints, newConstraints.uniqueConstraints);

          // Migrate check constraints (if supported)
          if (newConstraints.checkConstraints.length > 0) {
               await this.migrateCheckConstraints(tableName, oldConstraints.checkConstraints, newConstraints.checkConstraints);
          }
     }

     async migrateForeignKeys(tableName, oldFKs, newFKs) {
          const oldFKMap = new Map(oldFKs.map(fk => [fk.CONSTRAINT_NAME, fk]));
          const newFKMap = new Map(newFKs.map(fk => [fk.CONSTRAINT_NAME, fk]));

          // Add new foreign keys
          for (const [constraintName, newFK] of newFKMap) {
               if (!oldFKMap.has(constraintName)) {
                    console.log(`  🔗 Adding foreign key '${constraintName}'`);
                    const fkSql = `ALTER TABLE \`${tableName}\` ADD CONSTRAINT \`${constraintName}\` FOREIGN KEY (\`${newFK.COLUMN_NAME}\`) REFERENCES \`${newFK.REFERENCED_TABLE_NAME}\` (\`${newFK.REFERENCED_COLUMN_NAME}\`) ON UPDATE ${newFK.UPDATE_RULE} ON DELETE ${newFK.DELETE_RULE}`;
                    try {
                         await this.oldConnection.execute(fkSql);
                         console.log(`  ✅ Successfully added foreign key '${constraintName}'`);
                    } catch (error) {
                         console.log(`  ⚠️  Skipped adding foreign key '${constraintName}' due to table constraint issues: ${error.message}`);
                    }
               } else {
                    // Check if FK definition changed
                    const oldFK = oldFKMap.get(constraintName);
                    if (this.compareForeignKey(oldFK, newFK)) {
                         console.log(`  🔄 Updating foreign key '${constraintName}'`);
                         // Drop old FK and add new one
                         await this.oldConnection.execute(`ALTER TABLE \`${tableName}\` DROP FOREIGN KEY \`${constraintName}\``);
                         const fkSql = `ALTER TABLE \`${tableName}\` ADD CONSTRAINT \`${constraintName}\` FOREIGN KEY (\`${newFK.COLUMN_NAME}\`) REFERENCES \`${newFK.REFERENCED_TABLE_NAME}\` (\`${newFK.REFERENCED_COLUMN_NAME}\`) ON UPDATE ${newFK.UPDATE_RULE} ON DELETE ${newFK.DELETE_RULE}`;
                         await this.oldConnection.execute(fkSql);
                    }
               }
          }

          // Note: We don't drop old FKs for safety - they would need manual review
          for (const [constraintName] of oldFKMap) {
               if (!newFKMap.has(constraintName)) {
                    console.log(`  ⚠️  Foreign key '${constraintName}' exists in old DB but not in new DB - MANUAL REVIEW NEEDED`);
               }
          }
     }

     async migrateUniqueConstraints(tableName, oldUniques, newUniques) {
          const oldUniqueMap = new Map();
          const newUniqueMap = new Map();

          // Group by index name
          oldUniques.forEach(u => {
               if (!oldUniqueMap.has(u.INDEX_NAME)) {
                    oldUniqueMap.set(u.INDEX_NAME, []);
               }
               oldUniqueMap.get(u.INDEX_NAME).push(u);
          });

          newUniques.forEach(u => {
               if (!newUniqueMap.has(u.INDEX_NAME)) {
                    newUniqueMap.set(u.INDEX_NAME, []);
               }
               newUniqueMap.get(u.INDEX_NAME).push(u);
          });

          // Add new unique constraints
          for (const [indexName, newCols] of newUniqueMap) {
               if (!oldUniqueMap.has(indexName)) {
                    console.log(`  🔒 Adding unique constraint '${indexName}'`);
                    const columns = newCols.map(c => `\`${c.COLUMN_NAME}\``).join(', ');
                    const uniqueSql = `ALTER TABLE \`${tableName}\` ADD CONSTRAINT \`${indexName}\` UNIQUE (${columns})`;
                    try {
                         await this.oldConnection.execute(uniqueSql);
                         console.log(`  ✅ Successfully added unique constraint '${indexName}'`);
                    } catch (error) {
                         console.log(`  ⚠️  Skipped adding unique constraint '${indexName}' due to table constraint issues: ${error.message}`);
                    }
               } else {
                    // Check if unique constraint definition changed
                    const oldCols = oldUniqueMap.get(indexName);
                    if (this.compareUniqueConstraint(oldCols, newCols)) {
                         console.log(`  🔄 Updating unique constraint '${indexName}'`);
                         // Drop old unique and add new one
                         await this.oldConnection.execute(`ALTER TABLE \`${tableName}\` DROP INDEX \`${indexName}\``);
                         const columns = newCols.map(c => `\`${c.COLUMN_NAME}\``).join(', ');
                         const uniqueSql = `ALTER TABLE \`${tableName}\` ADD CONSTRAINT \`${indexName}\` UNIQUE (${columns})`;
                         await this.oldConnection.execute(uniqueSql);
                    }
               }
          }

          // Note: We don't drop old unique constraints for safety
          for (const [indexName] of oldUniqueMap) {
               if (!newUniqueMap.has(indexName)) {
                    console.log(`  ⚠️  Unique constraint '${indexName}' exists in old DB but not in new DB - MANUAL REVIEW NEEDED`);
               }
          }
     }

     async migrateCheckConstraints(tableName, oldChecks, newChecks) {
          const oldCheckMap = new Map(oldChecks.map(c => [c.CONSTRAINT_NAME, c]));
          const newCheckMap = new Map(newChecks.map(c => [c.CONSTRAINT_NAME, c]));

          // Add new check constraints
          for (const [constraintName, newCheck] of newCheckMap) {
               if (!oldCheckMap.has(constraintName)) {
                    console.log(`  ✅ Adding check constraint '${constraintName}'`);
                    const checkSql = `ALTER TABLE \`${tableName}\` ADD CONSTRAINT \`${constraintName}\` CHECK (${newCheck.CHECK_CLAUSE})`;
                    await this.oldConnection.execute(checkSql);
               } else {
                    // Check if check constraint changed
                    const oldCheck = oldCheckMap.get(constraintName);
                    if (oldCheck.CHECK_CLAUSE !== newCheck.CHECK_CLAUSE) {
                         console.log(`  🔄 Updating check constraint '${constraintName}'`);
                         await this.oldConnection.execute(`ALTER TABLE \`${tableName}\` DROP CHECK \`${constraintName}\``);
                         const checkSql = `ALTER TABLE \`${tableName}\` ADD CONSTRAINT \`${constraintName}\` CHECK (${newCheck.CHECK_CLAUSE})`;
                         await this.oldConnection.execute(checkSql);
                    }
               }
          }

          // Note: We don't drop old check constraints for safety
          for (const [constraintName] of oldCheckMap) {
               if (!newCheckMap.has(constraintName)) {
                    console.log(`  ⚠️  Check constraint '${constraintName}' exists in old DB but not in new DB - MANUAL REVIEW NEEDED`);
               }
          }
     }

     async addColumn(tableName, columnDef) {
          let alterSql = `ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnDef.COLUMN_NAME}\` ${columnDef.COLUMN_TYPE}`;

          if (columnDef.IS_NULLABLE === 'NO') {
               alterSql += ' NOT NULL';
          }

          // Handle defaults specially for different data types
          if (columnDef.COLUMN_DEFAULT !== null && columnDef.COLUMN_DEFAULT !== 'NULL') {
               if (columnDef.DATA_TYPE === 'varchar' || columnDef.DATA_TYPE === 'text' || columnDef.DATA_TYPE === 'char') {
                    alterSql += ` DEFAULT '${columnDef.COLUMN_DEFAULT}'`;
               } else if (columnDef.DATA_TYPE === 'timestamp' || columnDef.DATA_TYPE === 'datetime') {
                    // Handle timestamp/datetime defaults specially
                    const defaultVal = columnDef.COLUMN_DEFAULT.toLowerCase();
                    if (defaultVal === 'current_timestamp()' ||
                         defaultVal === 'current_timestamp' ||
                         defaultVal.includes('current_timestamp')) {
                         // Extract precision if present (e.g., current_timestamp(6))
                         const precisionMatch = columnDef.COLUMN_DEFAULT.match(/current_timestamp\((\d+)\)/i);
                         if (precisionMatch) {
                              alterSql += ` DEFAULT CURRENT_TIMESTAMP(${precisionMatch[1]})`;
                         } else {
                              alterSql += ` DEFAULT CURRENT_TIMESTAMP`;
                         }
                    } else {
                         alterSql += ` DEFAULT '${columnDef.COLUMN_DEFAULT}'`;
                    }
               } else {
                    alterSql += ` DEFAULT ${columnDef.COLUMN_DEFAULT}`;
               }
          } else if ((columnDef.DATA_TYPE === 'timestamp' || columnDef.DATA_TYPE === 'datetime') && columnDef.IS_NULLABLE === 'NO') {
               // For NOT NULL timestamp/datetime columns without explicit default, use CURRENT_TIMESTAMP
               alterSql += ` DEFAULT CURRENT_TIMESTAMP`;
          }

          // Check if this column is a primary key and is an integer - if so, ensure AUTO_INCREMENT
          if (columnDef.COLUMN_KEY === 'PRI' && ['int', 'smallint', 'mediumint', 'bigint', 'tinyint'].includes(columnDef.DATA_TYPE)) {
               if (!alterSql.toUpperCase().includes('AUTO_INCREMENT')) {
                    alterSql += ' AUTO_INCREMENT';
               }
          } else if (columnDef.EXTRA) {
               // Preserve existing EXTRA attributes for non-primary-key columns
               alterSql += ` ${columnDef.EXTRA}`;
          }

          await this.oldConnection.execute(alterSql);
     }

     compareForeignKey(oldFK, newFK) {
          return oldFK.COLUMN_NAME !== newFK.COLUMN_NAME ||
               oldFK.REFERENCED_TABLE_NAME !== newFK.REFERENCED_TABLE_NAME ||
               oldFK.REFERENCED_COLUMN_NAME !== newFK.REFERENCED_COLUMN_NAME ||
               oldFK.UPDATE_RULE !== newFK.UPDATE_RULE ||
               oldFK.DELETE_RULE !== newFK.DELETE_RULE;
     }

     compareUniqueConstraint(oldCols, newCols) {
          if (oldCols.length !== newCols.length) return true;

          // Sort columns by sequence for comparison
          const oldSorted = oldCols.sort((a, b) => a.SEQ_IN_INDEX - b.SEQ_IN_INDEX);
          const newSorted = newCols.sort((a, b) => a.SEQ_IN_INDEX - b.SEQ_IN_INDEX);

          for (let i = 0; i < oldSorted.length; i++) {
               if (oldSorted[i].COLUMN_NAME !== newSorted[i].COLUMN_NAME) {
                    return true;
               }
          }

          return false;
     }

     async performMigration() {
          console.log('\n=== DATABASE MIGRATION STARTED ===');

          const oldTables = await this.getTables(this.oldConnection);
          const newTables = await this.getTables(this.newConnection);

          // Get views to exclude them from table migration
          const oldViews = await this.getViews(this.oldConnection);
          const newViews = await this.getViews(this.newConnection);

          console.log(`Old database has ${oldTables.length} tables/views`);
          console.log(`New database has ${newTables.length} tables/views`);
          console.log(`Old database has ${oldViews.length} views`);
          console.log(`New database has ${newViews.length} views`);

          // Find tables that exist in both databases (exclude views)
          const commonTables = newTables.filter(table =>
               oldTables.includes(table) &&
               !oldViews.includes(table) &&
               !newViews.includes(table)
          );
          console.log(`Common base tables to migrate: ${commonTables.length}`);

          // Find obsolete tables (exist in old DB but not in new DB, exclude views)
          const obsoleteTables = oldTables.filter(table =>
               !newTables.includes(table) &&
               !oldViews.includes(table)
          );
          console.log(`Obsolete tables to handle: ${obsoleteTables.length}`);

          // STEP 3: Migrate existing table structures (focus on column differences)
          console.log('\n🔄 STEP 3: Migrating existing table structures...');
          console.log(`\n🔄 Tables to migrate: ${commonTables.join(', ')}`);

          for (const tableName of commonTables) {
               await this.migrateTableStructure(tableName);
          }

          // STEP 4: Migrate views
          console.log('\n👁️  STEP 4: Migrating views...');
          const migratedViews = await this.migrateViews();

          // STEP 5: Migrate payroll tables
          console.log('\n💰 STEP 5: Migrating payroll tables...');
          const migratedPayrollTables = await this.migratePayrollTables();

          // STEP 6: Migrate purchase tables
          console.log('\n🛒 STEP 6: Migrating purchase tables...');
          const migratedPurchaseTables = await this.migratePurchaseTables();

          // STEP 7: Summary
          console.log('\n📊 MIGRATION SUMMARY:');
          console.log(`   🔄 Tables migrated: ${commonTables.length}`);
          console.log(`   👁️  Views migrated: ${migratedViews}`);
          console.log(`   💰 Payroll tables migrated: ${migratedPayrollTables}`);
          console.log(`   🛒 Purchase tables migrated: ${migratedPurchaseTables}`);
          console.log('\n⚠️  IMPORTANT NOTES:');
          console.log('   - Only tables existing in both databases were migrated');
          console.log('   - Column structures have been updated to match new schema');
          console.log('   - Foreign keys and constraints have been migrated');
          console.log('   - Views were recreated from new database');
          console.log('   - Stored procedures and triggers will be executed from SQL files');
          console.log('   - Payroll tables were migrated from new-payrol.sql file');
          console.log('   - Purchase tables were migrated from new-purchase.sql file');
     }



     async migrateViews() {
          const newViews = await this.getViews(this.newConnection);
          let migratedCount = 0;

          for (const viewName of newViews) {
               try {
                    // Get CREATE VIEW statement from new DB
                    const [rows] = await this.newConnection.execute(`SHOW CREATE VIEW \`${viewName}\``);
                    const createViewSql = rows[0]['Create View'];

                    // Drop if exists in old DB
                    await this.oldConnection.execute(`DROP VIEW IF EXISTS \`${viewName}\``);

                    // Create in old DB
                    await this.oldConnection.execute(createViewSql);
                    console.log(`   ✅ Migrated view '${viewName}'`);
                    migratedCount++;
               } catch (error) {
                    console.error(`   ❌ Failed to migrate view '${viewName}':`, error.message);
               }
          }

          return migratedCount;
     }





     async migratePayrollTables() {
          let migratedCount = 0;

          try {
               // Check if payroll SQL file exists
               if (fs.existsSync('new-payrol.sql')) {
                    // Read the payroll SQL file
                    const payrollSql = fs.readFileSync('new-payrol.sql', 'utf8');

                    // Split by CREATE TABLE to get individual table definitions
                    const tableBlocks = payrollSql.split('CREATE TABLE');

                    for (let i = 1; i < tableBlocks.length; i++) { // Start from 1 to skip empty first element
                         const block = tableBlocks[i].trim();

                         if (block) {
                              // Extract table name from the block
                              const tableNameMatch = block.match(/^`([^`]+)`/);
                              if (tableNameMatch) {
                                   const tableName = tableNameMatch[1];

                                   // Reconstruct the full CREATE TABLE statement
                                   const createTableSql = 'CREATE TABLE ' + block.trim();

                                   try {
                                        // Execute the CREATE TABLE statement
                                        await this.oldConnection.query(createTableSql);
                                        console.log(`   ✅ Migrated payroll table '${tableName}'`);
                                        migratedCount++;
                                   } catch (error) {
                                        // Check if the error is just that the table already exists
                                        if (error.message && error.message.includes('already exists')) {
                                             console.log(`   ⏭️  Payroll table '${tableName}' already exists, skipping...`);
                                        } else {
                                             console.error(`   ❌ Failed to execute payroll table '${tableName}':`, error.message);
                                        }
                                   }
                              }
                         }
                    }
               } else {
                    console.log('   No new-payrol.sql file found, skipping payroll table migration...');
               }
          } catch (error) {
               console.error(`   ❌ Failed to migrate payroll tables:`, error.message);
          }

          return migratedCount;
     }

     async migratePurchaseTables() {
          let migratedCount = 0;

          try {
               // Check if purchase SQL file exists
               if (fs.existsSync('new-purchase.sql')) {
                    // Read the purchase SQL file
                    const purchaseSql = fs.readFileSync('new-purchase.sql', 'utf8');

                    // Split by semicolon to get individual statements
                    const statements = purchaseSql.split(';').map(stmt => stmt.trim()).filter(stmt => stmt.length > 0);

                    for (const statement of statements) {
                         if (statement.toUpperCase().includes('CREATE TABLE')) {
                              // Handle CREATE TABLE statements
                              const tableNameMatch = statement.match(/CREATE TABLE (?:IF NOT EXISTS )?`([^`]+)`/i);
                              if (tableNameMatch) {
                                   const tableName = tableNameMatch[1];
                                   try {
                                        await this.oldConnection.query(statement + ';');
                                        console.log(`   ✅ Migrated purchase table '${tableName}'`);
                                        migratedCount++;
                                   } catch (error) {
                                        if (error.message && error.message.includes('already exists')) {
                                             console.log(`   ⏭️  Purchase table '${tableName}' already exists, skipping...`);
                                        } else {
                                             console.error(`   ❌ Failed to execute purchase table '${tableName}':`, error.message);
                                        }
                                   }
                              }
                         } else if (statement.toUpperCase().includes('ALTER TABLE')) {
                              // Handle ALTER TABLE statements
                              try {
                                   await this.oldConnection.query(statement + ';');
                                   console.log(`   ✅ Applied ALTER TABLE modification`);
                                   migratedCount++;
                              } catch (error) {
                                   if (error.message && error.message.includes('already exists')) {
                                        console.log(`   ⏭️  ALTER TABLE modification already applied, skipping...`);
                                   } else {
                                        console.error(`   ❌ Failed to execute ALTER TABLE:`, error.message);
                                   }
                              }
                         } else if (statement.toUpperCase().includes('CREATE INDEX')) {
                              // Handle CREATE INDEX statements
                              try {
                                   await this.oldConnection.query(statement + ';');
                                   console.log(`   ✅ Created index`);
                                   migratedCount++;
                              } catch (error) {
                                   if (error.message && (error.message.includes('already exists') || error.message.includes('Duplicate key'))) {
                                        console.log(`   ⏭️  Index already exists, skipping...`);
                                   } else {
                                        console.error(`   ❌ Failed to create index:`, error.message);
                                   }
                              }
                         }
                         // Skip comments and other statements
                    }

               } else {
                    console.log('   No new-purchase.sql file found, skipping purchase table migration...');
               }
          } catch (error) {
               console.error(`   ❌ Failed to migrate purchase tables:`, error.message);
          }

          return migratedCount;
     }

     async migratePayrollTables() {
          let migratedCount = 0;

          try {
               // Check if payroll SQL file exists
               if (fs.existsSync('new-payrol.sql')) {
                    // Read the payroll SQL file
                    const payrollSql = fs.readFileSync('new-payrol.sql', 'utf8');

                    // Split by semicolon to get individual statements
                    const statements = payrollSql.split(';').map(stmt => stmt.trim()).filter(stmt => stmt.length > 0);

                    for (const statement of statements) {
                         if (statement.toUpperCase().includes('CREATE TABLE')) {
                              // Handle CREATE TABLE statements
                              const tableNameMatch = statement.match(/CREATE TABLE (?:IF NOT EXISTS )?`([^`]+)`/i);
                              if (tableNameMatch) {
                                   const tableName = tableNameMatch[1];

                                   // First try to create table without foreign keys
                                   let createTableSql = statement;

                                   // Remove foreign key constraints for initial creation
                                   createTableSql = createTableSql.replace(/,\s*FOREIGN KEY\s*\([^)]+\)\s*REFERENCES\s*[^,]+/gi, '');
                                   createTableSql = createTableSql.replace(/FOREIGN KEY\s*\([^)]+\)\s*REFERENCES\s*[^,]+,\s*/gi, '');
                                   createTableSql = createTableSql.replace(/FOREIGN KEY\s*\([^)]+\)\s*REFERENCES\s*[^;]+;?/gi, '');

                                   try {
                                        await this.oldConnection.query(createTableSql + ';');
                                        console.log(`   ✅ Migrated payroll table '${tableName}' (without FKs)`);
                                        migratedCount++;

                                        // Now try to add foreign keys separately
                                        const fkMatches = statement.match(/FOREIGN KEY\s*\([^)]+\)\s*REFERENCES\s*[^,;\n]+/gi);
                                        if (fkMatches) {
                                             for (const fkConstraint of fkMatches) {
                                                  try {
                                                       const alterSql = `ALTER TABLE \`${tableName}\` ADD ${fkConstraint}`;
                                                       await this.oldConnection.query(alterSql);
                                                       console.log(`   ✅ Added foreign key to '${tableName}'`);
                                                  } catch (fkError) {
                                                       console.log(`   ⚠️  Could not add foreign key to '${tableName}': ${fkConstraint.substring(0, 50)}...`);
                                                  }
                                             }
                                        }

                                   } catch (error) {
                                        if (error.message && error.message.includes('already exists')) {
                                             console.log(`   ⏭️  Payroll table '${tableName}' already exists, skipping...`);
                                        } else {
                                             console.error(`   ❌ Failed to execute payroll table '${tableName}':`, error.message);
                                        }
                                   }
                              }
                         }
                         // Skip comments and other statements
                    }

               } else {
                    console.log('   No new-payrol.sql file found, skipping payroll table migration...');
               }
          } catch (error) {
               console.error(`   ❌ Failed to migrate payroll tables:`, error.message);
          }

          return migratedCount;
     }

     async getPrimaryKeys(connection, tableName) {
          const [rows] = await connection.execute(`
            SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = ?
            AND COLUMN_KEY = 'PRI'
        `, [tableName]);
          return rows;
     }

     async runMigrationFiles() {
          console.log('Running migration SQL files...');

          const migrationFiles = [
               { name: 'new-payrol.sql', useMultipleStatements: true },
               { name: 'new-purchase.sql', useMultipleStatements: true },
               { name: 'new-expense.sql', useMultipleStatements: true },
               { name: 'new-incidents.sql', useMultipleStatements: true },

          ];

          for (const fileInfo of migrationFiles) {
               const fileName = fileInfo.name;
               const filePath = path.join(__dirname, fileName);

               if (!fs.existsSync(filePath)) {
                    console.log(`   ⚠️  ${fileName} not found, skipping...`);
                    continue;
               }

               console.log(`   📄 Executing ${fileName}...`);
               const sqlContent = fs.readFileSync(filePath, 'utf8');

               // For triggers and procedures, execute as-is with multipleStatements
               if (fileInfo.skipParsing) {
                    const connection = await mysql.createConnection({
                         ...oldDbConfig,
                         multipleStatements: true
                    });

                    try {
                         // Remove DELIMITER commands as mysql2 doesn't support them
                         const cleanedSql = sqlContent
                              .replace(/DELIMITER\s+\$\$/gi, '')
                              .replace(/DELIMITER\s+;/gi, '')
                              .replace(/\$\$/g, ';');

                         await connection.query(cleanedSql);
                         console.log(`   ✅ ${fileName} executed successfully`);
                    } catch (error) {
                         console.warn(`   ⚠️  Some statements from ${fileName} failed:`, error.message);
                         console.log(`   ✅ ${fileName} completed with warnings`);
                    } finally {
                         await connection.end();
                    }
               } else {
                    // For other files, parse normally
                    const connection = await mysql.createConnection({
                         ...oldDbConfig,
                         multipleStatements: true
                    });

                    try {
                         const statements = this.parseSqlWithDelimiters(sqlContent);

                         for (const statement of statements) {
                              if (statement.trim()) {
                                   try {
                                        await connection.execute(statement);
                                   } catch (error) {
                                        console.warn(`   ⚠️  Failed to execute statement from ${fileName}:`, error.message);
                                   }
                              }
                         }

                         console.log(`   ✅ ${fileName} executed successfully`);
                    } catch (error) {
                         console.error(`Error running ${fileName}:`, error);
                    } finally {
                         await connection.end();
                    }
               }
          }
     }

     parseSqlWithDelimiters(sqlContent) {
          const statements = [];

          // Remove comments and normalize line endings
          sqlContent = sqlContent.replace(/--[^\n]*\n/g, '\n');
          sqlContent = sqlContent.replace(/\/\*[\s\S]*?\*\//g, '');

          let currentDelimiter = ';';
          let currentStatement = '';
          let inDelimiterBlock = false;

          const lines = sqlContent.split('\n');

          for (let i = 0; i < lines.length; i++) {
               const line = lines[i].trim();

               // Check for DELIMITER command
               if (line.toUpperCase().startsWith('DELIMITER ')) {
                    // Save any pending statement
                    if (currentStatement.trim()) {
                         statements.push(currentStatement.trim());
                         currentStatement = '';
                    }

                    // Extract new delimiter
                    currentDelimiter = line.substring(10).trim();
                    inDelimiterBlock = (currentDelimiter !== ';');
                    continue;
               }

               // Skip empty lines
               if (!line) continue;

               // Add line to current statement
               currentStatement += line + '\n';

               // Check if statement ends with current delimiter
               if (line.endsWith(currentDelimiter)) {
                    // Remove delimiter from end
                    currentStatement = currentStatement.substring(0, currentStatement.lastIndexOf(currentDelimiter)).trim();

                    // Save statement if not empty
                    if (currentStatement.trim()) {
                         statements.push(currentStatement.trim());
                    }

                    currentStatement = '';
               }
          }

          // Add any remaining statement
          if (currentStatement.trim()) {
               statements.push(currentStatement.trim());
          }

          return statements.filter(stmt => stmt.length > 0);
     }

     async run() {
          console.log('Starting comprehensive database migration process...');
          const startTime = new Date();
          console.log(`🚀 Migration started at: ${startTime.toISOString()}`);

          try {
               console.log('🔄 STEP 1: Running database migration...');
               const step1Start = new Date();
               await this.connect();
               await this.performMigration();
               const step1End = new Date();
               console.log(`✅ STEP 1 completed in: ${(step1End - step1Start) / 1000} seconds`);

               console.log('📄 STEP 2: Running migration SQL files...');
               const step2Start = new Date();
               await this.runMigrationFiles();
               const step2End = new Date();
               console.log(`✅ STEP 2 completed in: ${(step2End - step2Start) / 1000} seconds`);

               const endTime = new Date();
               const totalDuration = (endTime - startTime) / 1000;
               console.log(`✅ Complete migration process finished successfully!`);
               console.log(`⏱️  Total migration time: ${totalDuration} seconds`);
               console.log(`🏁 Migration completed at: ${endTime.toISOString()}`);
          } catch (error) {
               const errorTime = new Date();
               console.error(`❌ Migration process failed at: ${errorTime.toISOString()}`);
               console.error('Migration process failed:', error);
          } finally {
               await this.disconnect();
          }
     }
}


new DatabaseMigrator().run();