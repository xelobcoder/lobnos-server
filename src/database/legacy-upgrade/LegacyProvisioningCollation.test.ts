import { afterEach, describe, expect, it, vi } from 'vitest';
import mysql from 'mysql2/promise';
import { cloneSchema } from '../../../scripts/setup-new-client';

vi.mock('mysql2/promise', () => ({ default: { createConnection: vi.fn() } }));
const options = { host: 'localhost', port: 3306, user: 'fixture', password: '', source: 'source', target: 'target', skipSeed: true, registerTenant: false, force: false };

afterEach(() => vi.restoreAllMocks());

describe('legacy provisioning collation safeguards', () => {
    function connection(failDdl = false) {
        const query = vi.fn().mockImplementation(async (sql: string) => {
            if (sql.includes('SCHEMA_NAME FROM')) return [[{ SCHEMA_NAME: 'source' }]];
            if (sql.includes('SELECT TABLE_NAME FROM')) return [[]];
            if (sql.includes('SELECT TABLE_NAME, TABLE_TYPE')) return [[{ TABLE_NAME: 'records', TABLE_TYPE: 'BASE TABLE' }]];
            if (sql.includes('foreign_key_checks AS fk')) return [[{ fk: 1 }]];
            if (sql.startsWith('SHOW CREATE')) return [[{ 'Create Table': "CREATE TABLE `records` (\n `name` varchar(80) COLLATE utf8mb4_0900_ai_ci,\n `token` varchar(80) CHARACTER SET ascii COLLATE ascii_bin\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci" }]];
            if (failDdl && sql.startsWith('CREATE TABLE')) throw new Error('DDL failure');
            return [[]];
        });
        const end = vi.fn(async () => undefined);
        vi.mocked(mysql.createConnection, { partial: true }).mockResolvedValue({ query, end });
        return { query, end };
    }
    it('normalizes copied DDL and preserves binary fields instead of inheriting source collation drift', async () => {
        const { query, end } = connection();
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
        await cloneSchema(options);
        const ddl = query.mock.calls.find(([sql]) => sql.startsWith('CREATE TABLE'))[0];
        expect(ddl).toContain('COLLATE=utf8mb4_unicode_ci');
        expect(ddl).not.toContain('0900_ai_ci');
        expect(ddl).toContain('CHARACTER SET ascii COLLATE ascii_bin');
        expect(query).toHaveBeenCalledWith('CREATE DATABASE IF NOT EXISTS ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci', ['target']);
        expect(query).toHaveBeenCalledWith('SET FOREIGN_KEY_CHECKS = ?', [1]);
        expect(end).toHaveBeenCalled();
    });
    it('fails rather than reporting a partly created schema as successfully provisioned', async () => {
        const { query, end } = connection(true);
        await expect(cloneSchema(options)).rejects.toThrow('DDL failure');
        expect(query).toHaveBeenCalledWith('SET FOREIGN_KEY_CHECKS = ?', [1]);
        expect(end).toHaveBeenCalled();
    });
});
