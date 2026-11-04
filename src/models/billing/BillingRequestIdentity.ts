import { createHash } from 'crypto';

export function billingRequestKey(value: unknown): string {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{16,80}$/.test(value))
        throw new Error('A request_key of 16–80 letters, digits, dashes or underscores is required');
    return value;
}
function canonical(value: any): any {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort()
        .filter(k => value[k] !== undefined && !['request_key', 'requestKey'].includes(k)).map(k => [k, canonical(value[k])]));
    return value;
}
export const billingFingerprint = (value: any) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');

/** Unique-key reservation is part of the producer transaction; losing retries wait for its commit. */
export async function reserveBillingRequest(trx: any, table: string, key: string, fingerprint: string): Promise<any | null> {
    try { await trx(table).insert({ request_key: key, fingerprint, created_at: new Date() }); return null; }
    catch (error: any) {
        if (error.code !== 'ER_DUP_ENTRY') throw error;
        const row = await trx(table).where({ request_key: key }).forUpdate().first();
        if (row?.fingerprint !== fingerprint) throw new Error('Request key was used for different financial inputs');
        if (!row.result_json) throw new Error('Request is still being processed; retry with the same key');
        return typeof row.result_json === 'string' ? JSON.parse(row.result_json) : row.result_json;
    }
}
