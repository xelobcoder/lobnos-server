import type { Knex } from 'knex';
import { quoteIdentifier } from './LegacySchema';

interface ReviewedColumn {
    table: string;
    column: string;
    type: string;
    nullable: boolean;
    defaultValue: string | null;
    text?: boolean;
    maxLength?: number;
    allowed?: string[];
    range?: [number, number];
    decision: string;
}
const commissionTypes = ['percentage', 'fixed', 'tiered', 'hybrid', 'sliding_scale', 'volume', 'quota', 'accelerating'];
const paymentMethods = ['cash', 'check', 'bank_transfer', 'credit_card', 'wire_transfer', 'other', 'mobile_money', 'cheque'];
const allowances = ['housing', 'risk', 'transport', 'meal', 'medical', 'education', 'uniform', 'mobile', 'hazard', 'shift_allowance', 'professional_development', 'responsibillity', 'hardship', 'acting', 'other'];
const incidentStatuses = ['reported', 'investigating', 'root-cause-analysis', 'corrective-actions', 'resolved', 'closed'];
const enumeration = (values: string[]) => `enum(${values.map(value => `'${value}'`).join(',')})`;

/** Explicit, reviewed widening and default corrections. No reference data or permissions are imported. */
export const reviewedGmsColumns: ReviewedColumn[] = [
    { table: 'appointments', column: 'patientid', type: 'int unsigned', nullable: true, defaultValue: null, decision: 'Allow the supported unlinked appointment workflow; retain every linked patient ID.' },
    { table: 'clinicianbasicinfo', column: 'phone', type: 'varchar(13)', nullable: true, defaultValue: null, text: true, maxLength: 13, decision: 'Allow an unknown phone without changing stored contacts.' },
    ...['commission_configs', 'commission_tracking'].map(table => ({ table, column: 'commission_type', type: enumeration(commissionTypes), nullable: false, defaultValue: null, text: true, allowed: commissionTypes, decision: 'Extend the existing commission enumeration while retaining every legacy value.' })),
    ...['nhismembershipid', 'claimscheckcode'].map(column => ({ table: 'dboservices', column, type: 'varchar(64)', nullable: true, defaultValue: null, text: true, maxLength: 64, decision: 'Store insurance identifiers as text. Existing numeric values retain their decimal representation.' })),
    { table: 'dbotestresultapproval', column: 'approvedBy', type: 'varchar(2048)', nullable: true, defaultValue: null, text: true, maxLength: 2048, decision: 'Widen storage for multiple approvals without changing historical approvers.' },
    { table: 'dbovitalsigns', column: 'bp', type: 'varchar(32)', nullable: true, defaultValue: null, text: true, maxLength: 32, decision: 'Widen blood-pressure text and allow an unrecorded measurement.' },
    { table: 'dbovitalsigns', column: 'temperature', type: 'decimal(12,2)', nullable: true, defaultValue: null, decision: 'Widen precision without rounding or reinterpreting original temperatures.' },
    ...['pulse', 'respiration', 'spo2'].map(column => ({ table: 'dbovitalsigns', column, type: 'int', nullable: true, defaultValue: null, range: [-2147483648, 2147483647] as [number, number], decision: 'Allow unrecorded readings after verifying all existing values fit signed INT.' })),
    { table: 'expensesrecord', column: 'amount', type: 'decimal(14,2) unsigned', nullable: false, defaultValue: null, range: [0, 999999999999.99], decision: 'Support monetary fractions while preserving every original integer amount.' },
    { table: 'incidents', column: 'status', type: enumeration(incidentStatuses), nullable: false, defaultValue: 'reported', text: true, allowed: [...incidentStatuses, 'primelab-cause-analysis'], decision: 'Archive and normalize the obsolete cause-analysis spelling to the current application status.' },
    { table: 'inv_supplier_payments', column: 'payment_method', type: enumeration(paymentMethods), nullable: true, defaultValue: 'bank_transfer', text: true, allowed: paymentMethods, decision: 'Retain all existing methods and support cheque and mobile-money payments.' },
    { table: 'leads', column: 'contact_email', type: 'varchar(255)', nullable: true, defaultValue: null, text: true, maxLength: 255, decision: 'Allow unknown lead emails without replacing existing values.' },
    { table: 'payroll_employee_allowances', column: 'allowance_type', type: enumeration(allowances), nullable: false, defaultValue: null, text: true, allowed: allowances, decision: 'Extend supported allowance categories while retaining legacy spellings used by the application.' },
    { table: 'payroll_employee_other_deductions', column: 'deduction_type', type: 'varchar(100)', nullable: false, defaultValue: null, text: true, maxLength: 100, decision: 'Accept configured deduction codes while retaining existing categories.' },
    { table: 'primesmsjobrecipients', column: 'deliverystatus', type: 'varchar(32)', nullable: true, defaultValue: 'queued', text: true, maxLength: 32, decision: 'Allow current provider delivery states without rewriting historical states.' },
    { table: 'primesmsjobs', column: 'status', type: 'varchar(32)', nullable: true, defaultValue: 'pending', text: true, maxLength: 32, decision: 'Allow current campaign states without rewriting historical states.' },
    { table: 'roles', column: 'role', type: 'varchar(50)', nullable: false, defaultValue: 'scientist', text: true, maxLength: 50, decision: 'Support current role names. Existing role and permission assignments are retained.' },
    { table: 'roles', column: 'pin', type: 'int unsigned', nullable: true, defaultValue: null, decision: 'Use an absent PIN by default. Existing PINs are preserved until normal secure hash migration.' },
    ...['test_results', 'test_results_audit_log'].map(table => ({ table, column: 'entrymode', type: 'varchar(20)', nullable: true, defaultValue: 'manual', text: true, maxLength: 20, decision: 'Widen supported entry modes while preserving original result and audit values.' })),
];

export async function assertReviewedGmsValues(db: Knex): Promise<void> {
    for (const item of reviewedGmsColumns) {
        if (!await db.schema.hasColumn(item.table, item.column)) throw new Error(`Compatibility baseline required before reviewing ${item.table}.${item.column}`);
        let invalid;
        if (item.maxLength) invalid = await db(item.table).whereRaw('CHAR_LENGTH(CAST(?? AS CHAR)) > ?', [item.column, item.maxLength]).first(db.raw('1 AS present'));
        if (item.allowed) invalid = await db(item.table).whereNotNull(item.column).whereNotIn(item.column, item.allowed).first(db.raw('1 AS present'));
        if (item.range) invalid = await db(item.table).whereRaw('?? < ? OR ?? > ?', [item.column, item.range[0], item.column, item.range[1]]).first(db.raw('1 AS present'));
        if (invalid) throw new Error(`Reviewed upgrade blocked: ${item.table}.${item.column} contains a value outside the preserved range`);
    }
}

async function normalizeIncidentStatus(db: Knex): Promise<void> {
    if (!await db('incidents').where('status', 'primelab-cause-analysis').first('id')) return;
    const transitional = enumeration([...incidentStatuses, 'primelab-cause-analysis']);
    await db.raw(`ALTER TABLE incidents MODIFY COLUMN status ${transitional} NOT NULL DEFAULT 'reported'`);
    if (!await db.schema.hasTable('legacy_incident_status_migration')) await db.schema.createTable('legacy_incident_status_migration', table => {
        table.string('incident_id', 64).primary();
        table.string('previous_status', 100).notNullable();
        table.string('replacement_status', 100).notNullable();
        table.timestamp('migrated_at').notNullable().defaultTo(db.fn.now());
    });
    await db.transaction(async trx => {
        await trx.raw("INSERT IGNORE INTO legacy_incident_status_migration (incident_id, previous_status, replacement_status) SELECT id, status, 'root-cause-analysis' FROM incidents WHERE status = 'primelab-cause-analysis'");
        await trx('incidents').where('status', 'primelab-cause-analysis').update({ status: 'root-cause-analysis' });
    });
}

export async function applyReviewedGmsColumns(db: Knex): Promise<{ changed: string[]; verified: number }> {
    await assertReviewedGmsValues(db);
    await normalizeIncidentStatus(db);
    const changed: string[] = [];
    for (const item of reviewedGmsColumns) {
        const metadata = await db('information_schema.COLUMNS').whereRaw('TABLE_SCHEMA = DATABASE()')
            .where({ TABLE_NAME: item.table, COLUMN_NAME: item.column }).first();
        if (!metadata) throw new Error(`Missing metadata for ${item.table}.${item.column}`);
        if (metadata.COLUMN_TYPE.toLowerCase() === item.type && (metadata.IS_NULLABLE === 'YES') === item.nullable && metadata.COLUMN_DEFAULT === item.defaultValue) continue;
        const collation = item.text && metadata.CHARACTER_SET_NAME
            ? ` CHARACTER SET ${quoteIdentifier(metadata.CHARACTER_SET_NAME)} COLLATE ${quoteIdentifier(metadata.COLLATION_NAME)}` : '';
        const defaultSql = item.defaultValue == null ? (item.nullable ? ' DEFAULT NULL' : '') : ` DEFAULT '${item.defaultValue}'`;
        await db.raw(`ALTER TABLE ?? MODIFY COLUMN ?? ${item.type}${collation} ${item.nullable ? 'NULL' : 'NOT NULL'}${defaultSql} COMMENT ?`, [item.table, item.column, metadata.COLUMN_COMMENT || '']);
        changed.push(`${item.table}.${item.column}`);
    }
    return { changed, verified: reviewedGmsColumns.length };
}
