exports.up = function(knex){
    return knex.schema.createTable('patientimages', (table) => {
        table.increments('id').primary();
        table.integer('patientid').unsigned().notNullable();
        table.string('imagepath').notNullable();
        table.timestamps(true, true);
        table.foreign('patientid').references('patientid').inTable('new_patients').onDelete('CASCADE');
    });
};

exports.down = function(knex){
    return knex.schema.dropTable('patientimages');
};