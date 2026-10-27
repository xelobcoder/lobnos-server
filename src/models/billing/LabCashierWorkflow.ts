import {randomInt} from 'node:crypto';
import type {AuthUser} from '../../middleware/authority';
import {roleAllowed} from '../../middleware/roles';
export type LabCheckoutMode = 'direct' | 'separate_cashier';
export const isLabCheckoutMode = (value: unknown): value is LabCheckoutMode => value === 'direct' || value === 'separate_cashier';
export const labCashierCode = () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[randomInt(24)] + Array.from({length: 3}, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]).join('');
export const normalizeLabCashierCode = (value: unknown) => {
    const code = String(value ?? '').trim().toUpperCase();
    if (!/^[A-Z][A-Z2-9]{3}$/.test(code)) throw new Error('Enter the four-character cashier code.');
    return code;
};
export async function labCheckoutMode(db: any): Promise<LabCheckoutMode> {
    const settings = await db('applicationsettings').first();
    return settings?.labCheckoutMode === 'separate_cashier' ? 'separate_cashier' : 'direct';
}
export function requiresCashierHandoff(mode: LabCheckoutMode, payload: any) {
    return mode === 'separate_cashier' && !payload.isAdjustment && !payload.billingid;
}
export function assertUnpaidHandoff(payload: any) {
    if (Number(payload.paid || 0) > 0 || (payload.payments || []).some((p: any) => Number(p.amount) > 0 && !['foc','free','nhis'].includes(String(p.mode)))) {
        throw new Error('This laboratory uses a separate cashier. Save the bill without payment, then collect payment through Cash Collection.');
    }
}
/** Called inside the normal billing transaction; no second invoice, receipt or cash ledger is created. */
export async function createLabCashierCode(trx: any, billingid: number, branchid: number, employeeid: number, generate = labCashierCode): Promise<string> {
    const existing = await trx('lab_cashier_codes').where({billingid}).first();
    if (existing) return existing.code;
    for (let attempt = 0; attempt < 32; attempt++) {
        const code = generate();
        if (await trx('lab_cashier_codes').where({code}).first()) continue;
        try { await trx('lab_cashier_codes').insert({code, billingid, branchid, created_by: employeeid, created_at: new Date()}); return code; }
        catch (error: any) { if (error.code !== 'ER_DUP_ENTRY') throw error; }
    }
    throw new Error('Unable to allocate a cashier code. Please retry.');
}
export async function ensureLabCashierSchema(db: any) {
    if (!await db.schema.hasTable('lab_cashier_codes')) await db.schema.createTable('lab_cashier_codes', (t: any) => {
        t.string('code',4).primary(); t.integer('billingid').unsigned().notNullable().unique();
        t.integer('branchid').unsigned().notNullable().index(); t.integer('created_by').unsigned().notNullable(); t.timestamp('created_at').notNullable();
    });
    if (await db.schema.hasTable('applicationsettings') && !await db.schema.hasColumn('applicationsettings','labCheckoutMode')) {
        await db.schema.alterTable('applicationsettings', (t: any) => t.string('labCheckoutMode',24).notNullable().defaultTo('direct'));
    }
}
export async function lookupLabCashierCode(db: any, user: AuthUser, input: unknown) {
    if (!roleAllowed(user.role, ['admin','manager','cashier','accountant','customer service representative','scientist'])) throw new Error('Billing workspace access is required.');
    if (!Number.isSafeInteger(Number(user.branch)) || Number(user.branch) <= 0) throw new Error('Select your active location.');
    const code = normalizeLabCashierCode(input);
    const ticket = await db('lab_cashier_codes').where({code, branchid: Number(user.branch)}).first();
    if (!ticket) return null;
    const billing = await db('billing').where({billingid: ticket.billingid, branchid: Number(user.branch)}).first();
    if (!billing) return null;
    const patient = await db('new_patients').where({patientid: billing.patientid}).first();
    return {code, billingid: Number(billing.billingid), patientid: Number(billing.patientid),
        patientName: patient?.fullname || [patient?.firstname,patient?.middlename,patient?.lastname].filter(Boolean).join(' '),
        payable: Number(billing.payable || 0), outstanding: Number(billing.outstanding || 0), createdAt: ticket.created_at};
}
export async function lookupLabCashierBill(db: any, user: AuthUser, input: unknown) {
    if (!roleAllowed(user.role, ['admin','manager','cashier','accountant','customer service representative','scientist'])) throw new Error('Billing workspace access is required.');
    const billingid = Number(input);
    if (!Number.isSafeInteger(billingid) || billingid <= 0) throw new Error('Enter a valid bill ID.');
    const ticket = await db('lab_cashier_codes').where({billingid, branchid: Number(user.branch)}).first();
    return ticket ? lookupLabCashierCode(db, user, ticket.code) : null;
}
