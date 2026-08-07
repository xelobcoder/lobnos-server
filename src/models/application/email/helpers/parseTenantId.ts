export function parseTenantId(value: unknown): number {
     const parsed = typeof value === 'string' ? parseInt(value, 10) : Number(value);
     return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}
