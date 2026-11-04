import { describe, expect, it, vi } from 'vitest';
import { assessLegacySchema, columnDefinition, quoteIdentifier, renderLegacyUpgradeSql } from './LegacySchema';

function databaseFixture(target: any[], reference: any[], creates: Record<string, string>, populated = false) {
    const db: any = vi.fn((table: string) => {
        if (table === 'information_schema.COLUMNS') {
            let database: string;
            const query: any = { where: (_: string, name: string) => { database = name; return query; }, select: () => query,
                orderBy: async () => database === 'client' ? target : reference };
            return query;
        }
        return { withSchema: () => ({ first: async () => populated ? { present: 1 } : undefined }) };
    });
    db.raw = vi.fn(async (_: string, bindings: string[]) => [[{ 'Create Table': creates[bindings[1]] }]]);
    return db;
}
const column = (table: string, name: string, overrides = {}) => ({ table, name, type: 'int', nullable: 'YES', defaultValue: null, extra: '', ...overrides });

describe('legacy database compatibility planning', () => {
    it('quotes identifiers and extracts full column definitions without losing defaults', () => {
        expect(quoteIdentifier('a`b')).toBe('`a``b`');
        expect(columnDefinition('CREATE TABLE `t` (\n  `Label` varchar(80) DEFAULT \'a,b\',\n)', 'label')).toBe("`Label` varchar(80) DEFAULT 'a,b'");
    });
    it('handles case-insensitive MySQL columns, retains existing definitions and guards repeat execution', async () => {
        const target = [column('orders', 'ID')];
        const source = [column('orders', 'id', { type: 'bigint' }), column('orders', 'comment', { type: 'varchar(20)' })];
        const db = databaseFixture(target, source, { orders: 'CREATE TABLE `orders` (\n `id` bigint,\n `comment` varchar(20) DEFAULT NULL\n)' });
        const plan = await assessLegacySchema(db, 'client', 'current');
        expect(plan.steps).toHaveLength(1);
        expect(plan.steps[0].sql).toContain('ADD COLUMN `comment`');
        expect(plan.review).toHaveLength(1);
        const sql = renderLegacyUpgradeSql(plan);
        expect(sql).toContain('IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS');
        expect(sql).not.toMatch(/DROP TABLE|TRUNCATE|DELETE FROM|UPDATE /i);
        expect(sql).toContain('CONVERT(0x');
    });
    it('does not invent backfills for populated required fields', async () => {
        const plan = await assessLegacySchema(databaseFixture([column('orders', 'id')], [column('orders', 'id'), column('orders', 'owner', { nullable: 'NO' })],
            { orders: 'CREATE TABLE `orders` (\n `id` int,\n `owner` int NOT NULL\n)' }, true), 'client', 'current');
        expect(plan.steps).toEqual([]);
        expect(plan.review[0]).toContain('reviewed backfill');
    });
    it('creates missing tables in foreign-key order without disabling constraints or copying rows', async () => {
        const plan = await assessLegacySchema(databaseFixture([column('existing', 'id')], [column('existing', 'id'), column('child', 'id'), column('parent', 'id')], {
            existing: 'CREATE TABLE `existing` (\n `id` int\n)',
            child: 'CREATE TABLE `child` (\n `id` int, FOREIGN KEY (`id`) REFERENCES `parent` (`id`)\n)',
            parent: 'CREATE TABLE `parent` (\n `id` int PRIMARY KEY\n) AUTO_INCREMENT=50',
        }), 'client', 'current');
        expect(plan.steps.map(step => step.table)).toEqual(['parent', 'child']);
        expect(plan.steps[0].sql).not.toContain('AUTO_INCREMENT=50');
        expect(renderLegacyUpgradeSql(plan)).not.toMatch(/FOREIGN_KEY_CHECKS|INSERT INTO/);
    });
    it('blocks unresolved table dependencies and refuses source/target identity', async () => {
        const db = databaseFixture([column('existing', 'id')], [column('existing', 'id'), column('child', 'id')], {
            existing: 'CREATE TABLE `existing` (\n `id` int\n)', child: 'CREATE TABLE `child` (\n `id` int REFERENCES `absent` (`id`)\n)',
        });
        expect((await assessLegacySchema(db, 'client', 'current')).review[0]).toContain('unresolved foreign-key');
        await expect(assessLegacySchema(db, 'client', 'CLIENT')).rejects.toThrow('must differ');
    });
});
