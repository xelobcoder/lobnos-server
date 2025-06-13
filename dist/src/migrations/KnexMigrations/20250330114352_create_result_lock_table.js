exports.up = function (knex) {
    return knex.schema
        .createTable('result_lock', (table) => {
        table.increments('id').primary();
        table.integer('ascensionid').notNullable().unsigned();
        table.boolean('isResultLock').defaultTo(false);
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        table.foreign('ascensionid').references('id').inTable('test_ascension')
            .onDelete('CASCADE')
            .onUpdate('CASCADE');
        table.index('ascensionid');
        table.index('isResultLock');
    })
        .then(() => {
        return knex.raw(`
                    CREATE TRIGGER after_test_ascension_insert_result_lock
                    AFTER INSERT ON test_ascension
                    FOR EACH ROW
                    BEGIN
                         INSERT INTO result_lock (ascensionid, isResultLock, created_at, updated_at)
                         VALUES (NEW.id, false, NOW(), NOW());
                    END;
               `);
    });
};
exports.down = function (knex) {
    return knex.raw('DROP TRIGGER IF EXISTS after_test_ascension_insert')
        .then(() => {
        return knex.schema.dropTable('result_lock');
    });
};
