import { FinancialFinalizationGuard } from '../../accountingModule/services/FinancialFinalizationGuard';

/** Read the SOURCE sale, never the incoming correction date. Bill lock also serializes collectors. */
export async function lockMutableBill(db: any, tenantId: number, billingid: number): Promise<any> {
    const source = await db('billing').where({ billingid }).first();
    if (!source) throw new Error('Billing record not found');
    // Same order as daily finalization: day, then source record.
    await assertBillingDateOpen(db, tenantId, Number(source.branchid), source.billedon);
    const bill = await db('billing').where({ billingid }).forUpdate().first();
    if (!bill) throw new Error('Billing record not found');
    await assertMutableBill(db, tenantId, bill);
    return bill;
}

export async function assertBillingDateOpen(db: any, tenantId: number, branchid: number, value: any): Promise<void> {
    const date = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
    if (!Number.isSafeInteger(branchid) || branchid <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date))
        throw new Error('A valid source branch and financial date are required');
    const closure = await db('financial_day_closures').where({ branchid, financial_date: date }).forUpdate().first();
    if (closure?.status === 'finalized') throw new Error('Financial day is finalized and immutable');
    await new FinancialFinalizationGuard(tenantId, db).assertDateOpen(branchid, date);
}

export async function assertMutableBill(db: any, tenantId: number, bill: any): Promise<void> {
    if (Number(bill.record_validated_and_signed_off) === 1)
        throw new Error('CLOSED sale is immutable');
    const guard = new FinancialFinalizationGuard(tenantId, db);
    // Finalization locks this same day row before taking its signed snapshot.
    await assertBillingDateOpen(db, tenantId, Number(bill.branchid), bill.billedon);
    const record = await db('financial_record_locks').where({ source_table: 'billing', source_ref: String(bill.billingid) }).forUpdate().first();
    if (record) throw new Error('Financial record is finalized and immutable');
    await guard.assertRecordMutable('billing', bill.billingid);
    const nhisAllocation = await db('acc_nhis_allocations').where({ billingid: bill.billingid }).forUpdate().first();
    if (nhisAllocation) throw new Error('This bill has linked NHIS accounting events. Use NHIS settlements or linked reversals instead of changing the original bill.');
}

/** Derived close column: the existing sign-off/day-close/record manifest are the sole authority. */
export async function withBillingClosure(db: any, bills: any[]): Promise<any[]> {
    if (!bills.length) return bills;
    const locks = await db('financial_record_locks').where({ source_table: 'billing' })
        .whereIn('source_ref', bills.map(b => String(b.billingid)));
    const branches = [...new Set(bills.map(b => Number(b.branchid)))];
    const days = await db('financial_day_closures').whereIn('branchid', branches).where({ status: 'finalized' });
    const historical = await db('financial_historical_locks').whereIn('branchid', branches);
    return bills.map(bill => {
        const day = (value: any) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
        const lock = locks.find(l => String(l.source_ref) === String(bill.billingid));
        const closure = days.find(d => Number(d.branchid) === Number(bill.branchid) && day(d.financial_date) === day(bill.billedon));
        const range = historical.find(r => Number(r.branchid) === Number(bill.branchid) &&
            day(r.start_date) <= day(bill.billedon) && day(r.end_date) >= day(bill.billedon));
        const closed = !!lock || !!closure || !!range || Number(bill.record_validated_and_signed_off) === 1;
        return { ...bill, closed_status: closed ? 'CLOSED' : 'OPEN',
            closure_evidence: closed ? { closure_id: closure?.id || lock?.closure_id || null,
                closed_at: closure?.finalized_at || lock?.locked_at || range?.created_at || null,
                closed_by: closure?.owner_employeeid || bill.record_validated_and_signed_off_by || range?.created_by || null,
                historical_lock_id: range?.id || null,
                closure_type: range && !closure && !lock ? 'historical_migration' : 'finalization',
                signed_off: Number(bill.record_validated_and_signed_off) === 1 } : null };
    });
}
