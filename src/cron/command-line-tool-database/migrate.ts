#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import mysql from 'mysql2/promise';

interface DBConfig {
     host: string;
     user: string;
     password: string;
     database?: string;
     port: number;
}

const dbConfig: DBConfig = {
     host: 'localhost',
     user: 'primelab',
     password: 'Barcelona45##',
     port: 3306
};

const databaseName = 'primetenant005';

async function executeSQLFile(connection: mysql.Connection, filePath: string): Promise<void> {
     try {
          const rawSql = fs.readFileSync(filePath, 'utf8');
          console.log(`Processing ${path.basename(filePath)}...`);

          // Clean the SQL by removing phpMyAdmin headers and invalid statements
          let sql = cleanSQLDump(rawSql);

          if (!sql.trim()) {
               console.log(`⚠️  No valid SQL statements found in ${path.basename(filePath)}, skipping...`);
               return;
          }

          console.log(`Executing cleaned SQL from ${path.basename(filePath)}...`);

          // Execute the entire cleaned SQL as one query (MySQL can handle multiple statements)
          await connection.query(sql);

          console.log(`✅ Successfully processed ${path.basename(filePath)}`);
     } catch (error) {
          console.error(`❌ Error processing ${path.basename(filePath)}:`, error);
          throw error;
     }
}

function cleanSQLDump(sql: string): string {
     const lines = sql.split('\n');
     const cleanedLines: string[] = [];
     let skipSection = false;

     for (const line of lines) {
          const trimmed = line.trim();

          // Skip phpMyAdmin headers
          if (trimmed.startsWith('-- phpMyAdmin') ||
               trimmed.startsWith('-- version') ||
               trimmed.startsWith('-- https://') ||
               trimmed.startsWith('-- Host:') ||
               trimmed.startsWith('-- Generation Time:') ||
               trimmed.startsWith('-- Server version:') ||
               trimmed.startsWith('-- PHP Version:') ||
               trimmed === 'SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";' ||
               trimmed === 'START TRANSACTION;' ||
               trimmed.startsWith('SET time_zone =') ||
               trimmed.startsWith('/*!40101 SET') ||
               trimmed === '--' ||
               trimmed === '' ||
               trimmed.startsWith('-- Database:') ||
               trimmed.startsWith('-- Table structure for table') ||
               trimmed === '-- Indexes for dumped tables' ||
               trimmed === '-- AUTO_INCREMENT for dumped tables' ||
               trimmed === '-- Constraints for dumped tables' ||
               trimmed === '-- Triggers for dumped tables' ||
               trimmed.startsWith('-- Dumping data for table')) {
               continue;
          }

          // Skip INSERT statements (we only want schema)
          if (trimmed.startsWith('INSERT INTO')) {
               continue;
          }

          // Keep all other lines (CREATE TABLE, ALTER TABLE, DELIMITER, triggers, etc.)
          cleanedLines.push(line);
     }

     return cleanedLines.join('\n');
}

async function migrate(): Promise<void> {
     let connection: mysql.Connection | null = null;

     try {
          console.log('🔄 Connecting to MySQL server...');
          connection = await mysql.createConnection(dbConfig);
          console.log('✅ Connected to MySQL server');

          // Create database if it doesn't exist
          console.log(`🔄 Creating database '${databaseName}' if it doesn't exist...`);
          await connection.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\``);
          console.log(`✅ Database '${databaseName}' is ready`);

          // Close initial connection
          await connection.end();

          // Reconnect to the specific database
          console.log(`🔄 Connecting to database '${databaseName}'...`);
          const dbConfigWithDatabase = { ...dbConfig, database: databaseName, multipleStatements: true };
          connection = await mysql.createConnection(dbConfigWithDatabase);
          console.log(`✅ Connected to database '${databaseName}'`);

          const currentDir = __dirname;
          const sqlFiles = [
               // 'limsdb.sql',
               'organization-tables.sql',
               'prime-billing-tables.sql',
               'prime-inventory-table.sql',
               'prime-sms-tables.sql',
               'email.sql'
          ];

          for (const file of sqlFiles) {
               const filePath = path.join(currentDir, file);
               if (fs.existsSync(filePath)) {
                    await executeSQLFile(connection, filePath);
               } else {
                    console.warn(`⚠️  File ${file} not found, skipping...`);
               }
          }

          console.log('🎉 Migration completed successfully!');

     } catch (error) {
          console.error('💥 Migration failed:', error);
          process.exit(1);
     } finally {
          if (connection) {
               await connection.end();
               console.log('🔌 Database connection closed');
          }
     }
}

// Run the migration
migrate().catch(console.error);