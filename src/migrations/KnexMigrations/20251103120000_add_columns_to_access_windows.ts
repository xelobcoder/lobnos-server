exports.up = function (knex) {
     return knex.schema.createTable('access_windows', (table) => {
          table.increments('id').primary();
          table.integer('employeeid').notNullable();
          table.enum('category', ['global', 'individual']).notNullable().defaultTo('individual');
          table.enum('edit_window', ['1h', '4h', '8h', '12h', '24h', '1d', '1w', '2w', '1m']).notNullable();
          table.enum('access_window', ['1h', '4h', '8h', '12h', '24h', '1d', '1w', '2w', '1m']).notNullable();
          table.enum('applicable_role', ['scientist', 'phlebotomist', 'customer service representative', 'sonographer']).nullable();
          table.boolean('require_approval').defaultTo(false);
          table.timestamps(true, true);

          // Ensure uniqueness: only one record per employee per category
          table.unique(['employeeid', 'category']);
     });
};

exports.down = function (knex) {
     return knex.schema.dropTableIfExists('access_windows');
};