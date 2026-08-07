#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const promise_1 = __importDefault(require("mysql2/promise"));
const dbConfig = {
    host: 'localhost',
    user: 'primelab',
    password: 'Barcelona45##',
    port: 3306
};
const databaseName = 'primetenant005';
async function executeSQLFile(connection, filePath) {
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
    }
    catch (error) {
        console.error(`❌ Error processing ${path.basename(filePath)}:`, error);
        throw error;
    }
}
function cleanSQLDump(sql) {
    const lines = sql.split('\n');
    const cleanedLines = [];
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
async function migrate() {
    let connection = null;
    try {
        console.log('🔄 Connecting to MySQL server...');
        connection = await promise_1.default.createConnection(dbConfig);
        console.log('✅ Connected to MySQL server');
        // Create database if it doesn't exist
        console.log(`🔄 Creating database '${databaseName}' if it doesn't exist...`);
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\``);
        console.log(`✅ Database '${databaseName}' is ready`);
        // Close initial connection
        await connection.end();
        // Reconnect to the specific database
        console.log(`🔄 Connecting to database '${databaseName}'...`);
        const dbConfigWithDatabase = Object.assign(Object.assign({}, dbConfig), { database: databaseName, multipleStatements: true });
        connection = await promise_1.default.createConnection(dbConfigWithDatabase);
        console.log(`✅ Connected to database '${databaseName}'`);
        const currentDir = __dirname;
        const sqlFiles = [
            // 'limsdb.sql',
            'organization-tables.sql',
            'prime-billing-tables.sql',
            'prime-inventory-table.sql',
            'prime-sms-tables.sql',
            'email.sql',
            'noticaion.sql'
        ];
        for (const file of sqlFiles) {
            const filePath = path.join(currentDir, file);
            if (fs.existsSync(filePath)) {
                await executeSQLFile(connection, filePath);
            }
            else {
                console.warn(`⚠️  File ${file} not found, skipping...`);
            }
        }
        console.log('🎉 Migration completed successfully!');
    }
    catch (error) {
        console.error('💥 Migration failed:', error);
        process.exit(1);
    }
    finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Database connection closed');
        }
    }
}
// Run the migration
migrate().catch(console.error);
