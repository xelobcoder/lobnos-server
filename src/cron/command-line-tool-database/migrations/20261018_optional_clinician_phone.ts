import { Knex } from 'knex';

const SAFE_COLUMN_TYPE = /^(?:var)?char\(\d{1,3}\)$/i;
const SAFE_IDENTIFIER = /^\w+$/;

async function phoneColumn(knex: Knex) {
     if (!(await knex.schema.hasTable('clinicianbasicinfo')) || !(await knex.schema.hasColumn('clinicianbasicinfo', 'phone'))) return null;
     const [rows] = await knex.raw(
          `SELECT IS_NULLABLE AS nullable, COLUMN_TYPE AS columnType, CHARACTER_SET_NAME AS charset, COLLATION_NAME AS collation
           FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clinicianbasicinfo' AND COLUMN_NAME = 'phone'`);
     const column = Array.isArray(rows) ? rows[0] : null;
     if (!column || !SAFE_COLUMN_TYPE.test(String(column.columnType))) return null;
     const encoding = SAFE_IDENTIFIER.test(String(column.charset)) && SAFE_IDENTIFIER.test(String(column.collation))
          ? ` CHARACTER SET ${column.charset} COLLATE ${column.collation}` : '';
     return { nullable: column.nullable === 'YES', definition: `${column.columnType}${encoding}` };
}

/** Lets staff quick-add a referring clinician by name; the UNIQUE phone index still applies to provided numbers. */
export async function up(knex: Knex): Promise<void> {
     const column = await phoneColumn(knex);
     if (!column || column.nullable) return;
     await knex.raw(`ALTER TABLE clinicianbasicinfo MODIFY phone ${column.definition} NULL`);
}

export async function down(knex: Knex): Promise<void> {
     const column = await phoneColumn(knex);
     if (!column || !column.nullable) return;
     const missing = await knex('clinicianbasicinfo').whereNull('phone').count({ count: '*' }).first();
     if (Number(missing?.count || 0) > 0) {
          throw new Error('Cannot make clinician phone required while clinicians without a phone number exist.');
     }
     await knex.raw(`ALTER TABLE clinicianbasicinfo MODIFY phone ${column.definition} NOT NULL`);
}
