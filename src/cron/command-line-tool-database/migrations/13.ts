import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     // Create organization table
   
}

export async function down(knex: Knex): Promise<void> {
     // Drop tables in reverse order due to foreign key constraints
     const tables = [
          'outsourceorganizationservices',
          'outsourceorganizationcontract',
          'organization_packages',
          'organizationcontactperson',
          'organizationalbillingtable',
          'organizationaccountinformation',
          'outsourcingorganization',
          'organization'
     ];

     for (const table of tables) {
          await knex.schema.dropTableIfExists(table);
     }
}
