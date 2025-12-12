import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     // Salary Grades Configuration
     if (!(await knex.schema.hasTable('payroll_salary_grades'))) {
          await knex.schema.createTable('payroll_salary_grades', (table) => {
               table.increments('id').primary().unsigned();
               table.string('grade_name', 100).notNullable();
               table.string('grade_level', 50).notNullable();
               table.decimal('min_salary', 10, 2).nullable();
               table.decimal('max_salary', 10, 2).nullable();
               table.text('description').nullable();
               table.string('currency', 3).defaultTo('GHS');
               table.boolean('is_active').defaultTo(true);

               table.timestamp('created_at').defaultTo(knex.fn.now());
               table.timestamp('updated_at').defaultTo(knex.fn.now());
               table.integer('created_by').unsigned().nullable();
               table.integer('updated_by').unsigned().nullable();

               table.foreign('created_by').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');
               table.foreign('updated_by').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');

               table.unique(['grade_name']);
               table.index('grade_level');
               table.index('is_active');
          });
     }
}

export async function down(knex: Knex): Promise<void> {
     // Drop salary grades table
     await knex.schema.dropTableIfExists('payroll_salary_grades');
}