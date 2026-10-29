import type {Knex} from 'knex';
import {ensureSmsContactGroupSchema} from '../../../models/application/sms/SmsContactGroupSchema';
export const up=(db:Knex)=>ensureSmsContactGroupSchema(db);
export async function down(_db:Knex){/* Retain synchronized-contact and export audit records. */}
