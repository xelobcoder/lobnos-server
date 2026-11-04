import type { Knex } from 'knex';
import KnexConnection from '../../database/KnexConnections';
const ready = new WeakMap<object, Promise<void>>();
export async function ensureConsultationSchema(db: Knex) {
    if (await db.schema.hasTable('clinicianscredentials') && !await db.schema.hasColumn('clinicianscredentials','session_version')) {
        await db.schema.alterTable('clinicianscredentials', table => { table.integer('session_version').notNullable().defaultTo(0); });
    }
    if (!await db.schema.hasTable('practitioner_access'))
        await db.schema.createTable('practitioner_access', t => {
            t.integer('clinicianid').unsigned().primary();
            t.integer('staff_employeeid').unsigned().nullable().unique();
            t.integer('branchid').nullable();
            t.string('practice_type', 20).notNullable().defaultTo('external');
            t.boolean('enabled').notNullable().defaultTo(false);
            t.boolean('can_consult').notNullable().defaultTo(true);
            t.boolean('can_lab').notNullable().defaultTo(true);
            t.boolean('can_prescribe').notNullable().defaultTo(true);
            t.integer('version').notNullable().defaultTo(1);
            t.integer('updated_by').nullable();
            t.datetime('updated_at').nullable();
        });
    if (!await db.schema.hasTable('practitioner_invitations'))
        await db.schema.createTable('practitioner_invitations', t => {
            t.increments('id');
            t.integer('clinicianid').unsigned().notNullable().index();
            t.string('token_hash', 64).notNullable().unique();
            t.datetime('expires_at').notNullable();
            t.datetime('used_at').nullable();
            t.datetime('revoked_at').nullable();
            t.datetime('created_at').notNullable();
            t.integer('created_by').notNullable();
            t.string('channel', 10).notNullable();
            t.string('delivery_status', 30).notNullable();
        });
    if (!await db.schema.hasTable('practitioner_patient_access'))
        await db.schema.createTable('practitioner_patient_access', t => {
            t.increments('id');
            t.integer('clinicianid').unsigned().notNullable();
            t.integer('patientid').unsigned().notNullable();
            t.integer('granted_by').notNullable();
            t.datetime('created_at').notNullable();
            t.datetime('revoked_at').nullable();
            t.unique(['clinicianid', 'patientid']);
        });
    if (!await db.schema.hasTable('consultation_audit'))
        await db.schema.createTable('consultation_audit', t => {
            t.increments('id');
            t.string('entity', 30).notNullable();
            t.integer('entity_id').notNullable();
            t.string('action', 40).notNullable();
            t.integer('actor_id').notNullable();
            t.string('actor_type', 15).notNullable();
            t.text('details', 'longtext').nullable();
            t.datetime('created_at').notNullable();
            t.index(['entity', 'entity_id']);
        });
    for (const [name, create] of Object.entries({ author_type: (t: any) => t.string('author_type', 15).notNullable().defaultTo('legacy'), encounter_status: (t: any) => t.string('encounter_status', 15).notNullable().defaultTo('legacy'), revision: (t: any) => t.integer('revision').notNullable().defaultTo(1), request_key: (t: any) => t.string('request_key', 36).nullable().unique(), signed_at: (t: any) => t.datetime('signed_at').nullable(), updated_at: (t: any) => t.datetime('updated_at').nullable(), deleted_at: (t: any) => t.datetime('deleted_at').nullable() }))
        if (!await db.schema.hasColumn('medicalrecords', name))
            await db.schema.alterTable('medicalrecords', create);
    for (const [name, create] of Object.entries({ encounter_id: (t: any) => t.integer('encounter_id').nullable(), missing_reason: (t: any) => t.string('missing_reason', 500).nullable(), observed_at: (t: any) => t.datetime('observed_at').nullable(), observer_type: (t: any) => t.string('observer_type', 15).notNullable().defaultTo('legacy'), revision: (t: any) => t.integer('revision').notNullable().defaultTo(1), corrected_at: (t: any) => t.datetime('corrected_at').nullable(), weight_kg: (t: any) => t.decimal('weight_kg', 7, 2).nullable(), height_cm: (t: any) => t.decimal('height_cm', 7, 2).nullable() }))
        if (!await db.schema.hasColumn('dbovitalsigns', name))
            await db.schema.alterTable('dbovitalsigns', create);
    const roles = await db('roles').columnInfo();
    if (roles.role?.type === 'enum')
        await db.schema.alterTable('roles', t => t.string('role', 100).nullable().alter());
    const vitalColumns = await db('dbovitalsigns').columnInfo();
    if(!vitalColumns.time){await db.schema.alterTable('dbovitalsigns',t=>t.time('time').nullable());await db('dbovitalsigns').whereNull('time').whereNotNull('date').update({time:db.raw('TIME(??)',['date'])});}
    const definitions=await db('information_schema.COLUMNS').whereRaw('TABLE_SCHEMA=DATABASE()').where('TABLE_NAME','dbovitalsigns').whereIn('COLUMN_NAME',['bp','temperature','pulse','respiration','spo2']).select('COLUMN_NAME as name','COLUMN_TYPE as type');
    const fullTypes=new Map(definitions.map((row:any)=>[row.name,String(row.type)]));
    for(const field of ['bp','temperature','pulse','respiration','spo2']){const info=vitalColumns[field];if(!info)continue;let sqlType=fullTypes.get(field)||String(info.type);let changed=false;
      if(field==='bp'&&Number(info.maxLength||0)<32){sqlType='varchar(32)';changed=true;}
      if(field==='temperature'){const decimal=sqlType.match(/^decimal\((\d+),(\d+)\)$/i);if(decimal&&Number(decimal[2])<2){sqlType='decimal('+(Number(decimal[1])+2-Number(decimal[2]))+',2)';changed=true;}else if(/^int/i.test(sqlType)){sqlType='decimal(12,2)';changed=true;}}
      if(!/^[a-z]+(?:\(\d+(?:,\d+)?\))?(?: unsigned)?$/i.test(sqlType))throw Error('Unsupported vital column type');
      if(!info.nullable||changed)await db.schema.alterTable('dbovitalsigns',t=>t.specificType(field,sqlType).nullable().alter());
    }
    if (await db.schema.hasTable('prescriptions') && !await db.schema.hasColumn('prescriptions', 'prescriber_type'))
        await db.schema.alterTable('prescriptions', t => t.string('prescriber_type', 20).notNullable().defaultTo('legacy'));
    for (const table of ['entity_orders', 'prescriptions'])
        if (await db.schema.hasTable(table) && !await db.schema.hasColumn(table, 'request_key'))
            await db.schema.alterTable(table, t => t.string('request_key', 36).nullable().unique());
    const auditColumns=await db('consultation_audit').columnInfo();if(auditColumns.details?.type!=='longtext')await db.schema.alterTable('consultation_audit',t=>t.text('details','longtext').nullable().alter());
    const noteColumns=await db('medicalrecords').columnInfo();if(noteColumns.progress_report?.type!=='longtext')await db.schema.alterTable('medicalrecords',t=>t.text('progress_report','longtext').nullable().alter());
    // Historical observations remain historical; existing author identity is never guessed.
}
export async function consultationDb(tenantId: number) { const db = await KnexConnection(tenantId); let task = ready.get(db); if (!task) {
    task = ensureConsultationSchema(db).catch(e => { ready.delete(db); throw e; });
    ready.set(db, task);
} await task; return db; }
export function clinicalError(message: string, statusCode = 400): never { throw Object.assign(new Error(message), { statusCode }); }
export async function clinicalAudit(db: any, actor: any, entity: string, id: number, action: string, details: any = {}) { await db('consultation_audit').insert({ entity, entity_id: id, action, actor_id: actor.employeeid, actor_type: actor.role === 'clinician' ? 'clinician' : 'staff', details: JSON.stringify(details), created_at: new Date() }); }
