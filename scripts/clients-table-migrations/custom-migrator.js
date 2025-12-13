const mysql = require('mysql2/promise');

const olddatabase_connection = mysql.createPool({
     host: 'localhost',
     user: 'primelab',
     password: 'Barcelona45##',
     database: 'client-database-mig'
});

const newdatabase_connection = mysql.createPool({
     host: 'localhost',
     user: 'primelab',
     password: 'Barcelona45##',
     database: 'system-database-mig'
});

const oldTables = []
const newTables = []

async function fetchTables() {
     const [oldRows] = await olddatabase_connection.query("SHOW TABLES");
     oldRows.forEach(row => {
          const tableName = Object.values(row)[0];
          oldTables.push(tableName);
     });
     const [newRows] = await newdatabase_connection.query("SHOW TABLES");
     newRows.forEach(row => {
          const tableName = Object.values(row)[0];
          newTables.push(tableName);
     });
}

async function deleteObsolteteTables() {
     for (const oldTable of oldTables) {
          if (!newTables.includes(oldTable)) {
               console.log(`Deleting obsolete table: ${oldTable}`);
               await olddatabase_connection.query(`DROP TABLE \`${oldTable}\``);
               const index = oldTables.indexOf(oldTable);
               if (index > -1) {
                    oldTables.splice(index, 1);
               }
          }
     }
}

async function verifySignedIntegers() {
     const [rows] = await olddatabase_connection.query(srcript);
     if (rows.length === 0) {
          console.log('✅ No signed integer columns found in old database.');
     }
     else {
          console.log('⚠️  Signed integer columns found in old database:');
          rows.forEach(row => {
               signedTables.push({ tablename: row.TABLE_NAME, columnname: row.COLUMN_NAME, columntype: row.COLUMN_TYPE });
               console.log(`   Table: ${row.TABLE_NAME}, Column: ${row.COLUMN_NAME}, Type: ${row.COLUMN_TYPE}`);
          });
     }
}

const srcript = `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'client-database-mig'
  AND DATA_TYPE IN ('int','tinyint','smallint','mediumint','bigint')
  AND COLUMN_TYPE LIKE '%signed%'
ORDER BY TABLE_NAME, ORDINAL_POSITION;`

const signedTables = [];
async function ensureFirstColumnIsPrimaryKey(tableName) {
     try {
          // Get the first column of the table
          const [firstColumnResult] = await olddatabase_connection.query(`
               SELECT COLUMN_NAME, DATA_TYPE, COLUMN_KEY, EXTRA, IS_NULLABLE, COLUMN_DEFAULT
               FROM INFORMATION_SCHEMA.COLUMNS
               WHERE TABLE_SCHEMA = ?
                 AND TABLE_NAME = ?
                 AND ORDINAL_POSITION = 1
               LIMIT 1
          `, ['client-database-mig', tableName]);

          if (firstColumnResult.length === 0) {
               console.log(`⚠️  No first column found for table ${tableName}`);
               return;
          }

          const firstColumn = firstColumnResult[0];
          const { COLUMN_NAME: columnName, DATA_TYPE: dataType, COLUMN_KEY: columnKey, EXTRA: extra, IS_NULLABLE: isNullable, COLUMN_DEFAULT: columnDefault } = firstColumn;

          // Check if first column is an integer type
          if (!['int', 'smallint', 'mediumint', 'bigint', 'tinyint'].includes(dataType)) {
               console.log(`ℹ️  First column ${tableName}.${columnName} is ${dataType} - not making it primary key`);
               return;
          }

          // Check if it's already a primary key
          if (columnKey === 'PRI') {
               console.log(`✅ First column ${tableName}.${columnName} is already a primary key`);
               return;
          }

          console.log(`🔑 Making first column ${tableName}.${columnName} (${dataType}) a primary key with AUTO_INCREMENT`);

          // First, drop any existing primary key if it exists
          const [existingPK] = await olddatabase_connection.query(`
               SELECT CONSTRAINT_NAME
               FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
               WHERE TABLE_SCHEMA = ?
                 AND TABLE_NAME = ?
                 AND CONSTRAINT_NAME = 'PRIMARY'
          `, ['client-database-mig', tableName]);

          if (existingPK.length > 0) {
               console.log(`🗑️  Dropping existing primary key from ${tableName}`);
               await olddatabase_connection.query(`ALTER TABLE \`${tableName}\` DROP PRIMARY KEY`);
          }

          // Convert to unsigned if needed
          let columnType = 'INT(10) UNSIGNED';
          if (dataType === 'smallint') columnType = 'SMALLINT(10) UNSIGNED';
          else if (dataType === 'mediumint') columnType = 'MEDIUMINT(10) UNSIGNED';
          else if (dataType === 'bigint') columnType = 'BIGINT(10) UNSIGNED';
          else if (dataType === 'tinyint') columnType = 'TINYINT(10) UNSIGNED';

          // Build the ALTER TABLE statement
          let alterSql = `ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${columnName}\` ${columnType} NOT NULL AUTO_INCREMENT PRIMARY KEY`;

          console.log(`Executing: ${alterSql}`);
          await olddatabase_connection.query(alterSql);

          console.log(`✅ Successfully made ${tableName}.${columnName} a primary key with AUTO_INCREMENT`);

     } catch (error) {
          console.error(`❌ Error making first column primary key for ${tableName}:`, error.message);
     }
}

async function convertSignedIntegersToUnsigned() {
     for (const tableName of oldTables) {
          const tableStart = new Date();
          console.log(`[${tableStart.toISOString()}] 📊 Processing table: ${tableName}`);

          try {
               const [tableCheck] = await olddatabase_connection.query(
                    `SELECT TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES
                 WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
                    ['client-database-mig', tableName]
               );

               if (tableCheck.length === 0) {
                    console.log(`⚠️  Table ${tableName} not found, skipping`);
                    continue;
               }

               if (tableCheck[0].TABLE_TYPE === 'VIEW') {
                    console.log(`⚠️  Skipping view: ${tableName}`);
                    continue;
               }

               const [columns] = await olddatabase_connection.query(
                    `SELECT COLUMN_NAME, COLUMN_TYPE, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, COLUMN_KEY, GENERATION_EXPRESSION
                 FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = ?
                   AND TABLE_NAME = ?
                   AND DATA_TYPE IN ('int','tinyint','smallint','mediumint','bigint')
                   AND DATA_TYPE != 'tinyint'
                   AND COLUMN_TYPE NOT REGEXP 'unsigned'
                   AND (EXTRA IS NULL OR EXTRA NOT LIKE '%GENERATED%')
                 ORDER BY ORDINAL_POSITION`,
                    ['client-database-mig', tableName]
               );

               if (!columns.length) {
                    console.log(`No signed integer columns found in table: ${tableName}`);
                    continue;
               }

               for (const col of columns) {
                    const {
                         COLUMN_NAME: columnName,
                         COLUMN_TYPE: columnType,
                         DATA_TYPE: dataType,
                         IS_NULLABLE: isNullable,
                         COLUMN_DEFAULT: columnDefault,
                         EXTRA: extra,
                         COLUMN_KEY: columnKey,
                         GENERATION_EXPRESSION: genExpr
                    } = col;

                    if (genExpr || (extra && extra.includes('GENERATED'))) {
                         console.log(`⚠️  Skipping generated column ${tableName}.${columnName}`);
                         continue;
                    }

                    const unsignedType = `INT(10) UNSIGNED`;

                    let nullToken = isNullable === 'NO' ? 'NOT NULL' : 'NULL';
                    let extraClause = extra && extra.trim().length > 0 ? ` ${extra}` : '';

                    // If this column is a primary key and is an integer, ensure it has AUTO_INCREMENT
                    if (columnKey === 'PRI' && ['int', 'smallint', 'mediumint', 'bigint'].includes(dataType)) {
                         if (!extraClause.includes('AUTO_INCREMENT')) {
                              extraClause += ' AUTO_INCREMENT';
                              console.log(`🔑 Adding AUTO_INCREMENT to primary key column ${tableName}.${columnName}`);
                         }
                         // Primary keys should not be nullable
                         nullToken = 'NOT NULL';
                    }

                    let alterSql;

                    if (genExpr) {
                         const extraUpper = (extra || '').toUpperCase();
                         const storedToken = extraUpper.includes('STORED') ? 'STORED' : 'VIRTUAL';

                         alterSql = `ALTER TABLE \`${tableName}\` MODIFY \`${columnName}\` INT(10) UNSIGNED ${nullToken} ` +
                              `GENERATED ALWAYS AS (${genExpr}) ${storedToken}`;

                    } else {
                         let defaultClause = '';
                         if (columnDefault !== null) {
                              const defaultStr = String(columnDefault).toUpperCase().trim();

                              const looksLikeFunction = /\w+\([^)]*\)/.test(String(columnDefault)) ||
                                   defaultStr.includes('YEAR') ||
                                   defaultStr.includes('MONTH') ||
                                   defaultStr.includes('DAY') ||
                                   defaultStr.includes('CURDATE') ||
                                   defaultStr.includes('NOW') ||
                                   defaultStr.includes('CURRENT_TIMESTAMP') ||
                                   defaultStr.includes('CURRENT_DATE') ||
                                   defaultStr.includes('CURRENT_TIME') ||
                                   defaultStr.includes('LOCALTIME') ||
                                   defaultStr.includes('LOCALTIMESTAMP') ||
                                   defaultStr.includes("current_timestamp()") ||
                                   defaultStr.includes("current_date()") ||
                                   defaultStr.includes("current_time()") ||
                                   defaultStr.includes("dayofmonth(curdate())") ||
                                   defaultStr.includes("month(curdate())") ||
                                   defaultStr.includes("year(curdate())");

                              if (looksLikeFunction) {
                                   console.log(`⚠️  Skipping function-based default value for ${tableName}.${columnName}: ${columnDefault}`);
                              } else if (defaultStr === 'NULL') {
                                   defaultClause = ` DEFAULT NULL`;
                              } else if (!isNaN(columnDefault) && columnDefault !== '') {
                                   defaultClause = ` DEFAULT ${columnDefault}`;
                              } else {
                                   const safe = String(columnDefault).replace(/'/g, "''");
                                   defaultClause = ` DEFAULT '${safe}'`;
                              }
                         }

                         alterSql = `ALTER TABLE \`${tableName}\` MODIFY \`${columnName}\` INT(10) UNSIGNED ${nullToken}${defaultClause}${extraClause}`;
                    }

                    console.log(`Altering table ${tableName}, column ${columnName}: ${alterSql}`);

                    await olddatabase_connection.query(alterSql);

               }

               // After processing all signed integer columns, check if first column should be made primary key
               if (tableName !== 'accounts') {
                    await ensureFirstColumnIsPrimaryKey(tableName);
               }

               const tableEnd = new Date();
               console.log(`[${tableEnd.toISOString()}] ✅ Table ${tableName} completed (${tableEnd - tableStart}ms)`);
          } catch (error) {
               const tableEnd = new Date();
               console.error(`[${tableEnd.toISOString()}] ❌ Table ${tableName} failed (${tableEnd - tableStart}ms):`, error.message);
          }
     }
}
console.log('Starting migration...');
const migrationStart = new Date();
console.log(`[${migrationStart.toISOString()}] 🚀 MIGRATION STARTED: Database migration process beginning`);

fetchTables().then(async () => {
     const fetchEnd = new Date();
     console.log(`[${fetchEnd.toISOString()}] ✅ STEP 1 COMPLETED: Table discovery finished (${fetchEnd - migrationStart}ms)`);
     console.log('Old Database Tables:', oldTables);
     console.log('New Database Tables:', newTables);

     const deleteStart = new Date();
     console.log(`[${deleteStart.toISOString()}] 🗑️  STEP 2: Deleting obsolete tables...`);
     await deleteObsolteteTables();
     const deleteEnd = new Date();
     console.log(`[${deleteEnd.toISOString()}] ✅ STEP 2 COMPLETED: Obsolete table cleanup finished (${deleteEnd - deleteStart}ms)`);

     const convertStart = new Date();
     console.log(`[${convertStart.toISOString()}] 🔢 STEP 3: Converting signed integers to unsigned...`);
     await convertSignedIntegersToUnsigned();
     const convertEnd = new Date();
     console.log(`[${convertEnd.toISOString()}] ✅ STEP 3 COMPLETED: Integer conversion finished (${convertEnd - convertStart}ms)`);

     const migrationEnd = new Date();
     console.log(`[${migrationEnd.toISOString()}] 🎉 MIGRATION COMPLETED: All steps finished successfully (${migrationEnd - migrationStart}ms)`);
     console.log('Migration fetchTables completed.');
     process.exit(0);
}).catch(err => {
     const errorTime = new Date();
     console.log(`[${errorTime.toISOString()}] ❌ MIGRATION FAILED: Error during migration (${errorTime - migrationStart}ms)`);
     console.error('Error during migration:', err);
});
