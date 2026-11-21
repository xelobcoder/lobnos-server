import {ensureParameterDefinitionSchema} from '../../../models/TestCreation/parameterSchema';
export async function up(db:any){await ensureParameterDefinitionSchema(db);}
export async function down(){/* Preserve clinical configuration. */}
