import { Knex } from 'knex';
export async function up(db:Knex):Promise<void>{
     for(const table of ['pharmacy_sale_lines','pharmacy_held_sale_lines'])if(!await db.schema.hasColumn(table,'price_type'))await db.schema.alterTable(table,t=>t.string('price_type',16).notNullable().defaultTo('retail'));
}
export async function down(_db:Knex):Promise<void>{ /* Preserve the price basis of historical receipts. */ }
