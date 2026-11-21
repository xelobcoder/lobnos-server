import {Knex} from 'knex';
import {ensureParameterRequiredColumn} from '../../../models/TestCreation/parameterSchema';
export async function up(db:Knex){await ensureParameterRequiredColumn(db);}
export async function down(_db:Knex){/* Preserve saved required flags on rollback. */}
