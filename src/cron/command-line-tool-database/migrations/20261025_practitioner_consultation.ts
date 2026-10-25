import type {Knex} from 'knex';
import {ensureConsultationSchema} from '../../../models/consultation/ConsultationSchema';
export async function up(db:Knex){await ensureConsultationSchema(db)}
export async function down(){throw Error('Clinical identity, observation history and audit records must be retained; use a forward migration.');}
