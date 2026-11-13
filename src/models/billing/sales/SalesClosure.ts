/** Read-only capability detection: old facilities without closure infrastructure retain legacy reporting. */
export async function salesClosurePredicate(db: any, alias = 'bill'): Promise<string> {
    if (!/^[A-Za-z_]\w*$/.test(alias)) throw new Error('Invalid billing alias');
    const signed = await db.schema.hasColumn('billing', 'record_validated_and_signed_off');
    const days = await db.schema.hasTable('financial_day_closures');
    const records = await db.schema.hasTable('financial_record_locks');
    const historical = await db.schema.hasTable('financial_historical_locks');
    const evidence: string[] = [];
    if (signed) evidence.push(`${alias}.record_validated_and_signed_off = 1`);
    if (days) evidence.push(`EXISTS (SELECT 1 FROM financial_day_closures closure WHERE closure.branchid = ${alias}.branchid AND closure.financial_date = DATE(${alias}.billedon) AND closure.status = 'finalized')`);
    if (records) evidence.push(`EXISTS (SELECT 1 FROM financial_record_locks locked WHERE locked.source_table = 'billing' AND locked.source_ref = CAST(${alias}.billingid AS CHAR))`);
    if (historical) evidence.push(`EXISTS (SELECT 1 FROM financial_historical_locks historical WHERE historical.branchid = ${alias}.branchid AND DATE(${alias}.billedon) BETWEEN historical.start_date AND historical.end_date)`);
    return evidence.length ? `(${evidence.join(' OR ')})` : '1=1';
}
