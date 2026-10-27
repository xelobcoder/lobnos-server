import type { Knex } from 'knex';
import { ensureOrganizationDirectorySchema } from '../../../models/organization/OrganizationDirectorySchema';
export async function up(knex: Knex) { await ensureOrganizationDirectorySchema(knex); }
export async function down(knex: Knex) { await knex.schema.dropTableIfExists('organization_directory_lock'); }
