export const TENANT_COLLATION = 'utf8mb4_unicode_ci';
export const caseSensitiveCollation = (name: string) => /(?:_bin|_as_cs)$/.test(name);
export function normalizeSchemaTextCollations(sql: string): string {
    return sql.split('\n').map(line => {
        if (/COLLATE[ =]+\w*(?:_bin|_as_cs)\b/i.test(line)) return line;
        return line.replace(/CHARACTER SET\s+\w+/gi, 'CHARACTER SET utf8mb4')
            .replace(/DEFAULT CHARSET=\w+(?: COLLATE=\w+)?/gi, `DEFAULT CHARSET=utf8mb4 COLLATE=${TENANT_COLLATION}`)
            .replace(/\bCOLLATE([ =]+)\w+/gi, `COLLATE$1${TENANT_COLLATION}`);
    }).join('\n');
}


// MySQL protocol collation ID. The numeric driver setting keeps Knex charset DDL separate.
export const UNICODE_CI_PROTOCOL_ID = 224;
