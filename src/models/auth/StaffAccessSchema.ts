import { Knex } from 'knex';

/** Shared company identity infrastructure; no laboratory or pharmacy data dependencies. */
export async function ensureStaffAccessSchema(db: Knex) {
     if (!await db.schema.hasColumn('roles','access_revision')) await db.schema.alterTable('roles',t=>t.integer('access_revision').unsigned().notNullable().defaultTo(0));
     if (!await db.schema.hasTable('staff_role_access')) await db.schema.createTable('staff_role_access',t=>{
          t.string('id',36).primary(); t.integer('employeeid').unsigned().notNullable();
          t.string('role',80).notNullable(); t.integer('branchid').unsigned().notNullable();
          t.boolean('is_default').notNullable().defaultTo(false); t.integer('granted_by').unsigned().notNullable();
          t.timestamp('created_at').defaultTo(db.fn.now()); t.unique(['employeeid','role','branchid']);
     });
     if (!await db.schema.hasTable('staff_access_events')) await db.schema.createTable('staff_access_events',t=>{
          t.string('id',36).primary(); t.integer('employeeid').unsigned().notNullable();
          t.integer('performed_by').unsigned().notNullable(); t.string('action',40).notNullable();
          t.text('details').notNullable(); t.timestamp('created_at').defaultTo(db.fn.now());
          t.index(['employeeid','created_at']);
     });
}

export function staffAccessVersionMatches(claims: any, row: any) {
     return Number.isInteger(Number(claims?.arv ?? 0)) && Number(claims?.arv ?? 0) === Number(row?.access_revision || 0);
}
