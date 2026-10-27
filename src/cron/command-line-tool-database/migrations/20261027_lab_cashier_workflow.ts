import type {Knex} from 'knex';
import {ensureLabCashierSchema} from '../../../models/billing/LabCashierWorkflow';
export async function up(db: Knex) { await ensureLabCashierSchema(db); }
export async function down(db: Knex) { await db.schema.dropTableIfExists('lab_cashier_codes'); if(await db.schema.hasColumn('applicationsettings','labCheckoutMode')) await db.schema.alterTable('applicationsettings', t=>t.dropColumn('labCheckoutMode')); }
