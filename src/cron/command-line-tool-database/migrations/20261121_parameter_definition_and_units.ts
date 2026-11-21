import {Knex} from 'knex';
import {ensureParameterDefinitionSchema} from '../../../models/TestCreation/parameterSchema';
export async function up(db:Knex){await ensureParameterDefinitionSchema(db);}
export async function down(_db:Knex){/* Keep saved definitions on rollback. */}
