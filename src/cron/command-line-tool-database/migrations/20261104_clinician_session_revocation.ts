import {Knex} from 'knex';
export async function up(db:Knex){if(await db.schema.hasTable('clinicianscredentials')&&!await db.schema.hasColumn('clinicianscredentials','session_version'))await db.schema.alterTable('clinicianscredentials',table=>{table.integer('session_version').notNullable().defaultTo(0);});}
export async function down(_db:Knex){}
