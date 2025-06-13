exports.up = async function (knex) {
    await knex.schema.createTable('test_categories', function (table) {
        table.integer('ID').notNullable().primary();
        table.string('CATEGORY', 255).notNullable();
        table.string('DESCRIPTION', 255).notNullable();
    });
    await knex.schema.createTable('samplecontainer', (table) => {
        table.increments('id').primary();
        table.string('name', 255).notNullable().unique();
        table.text('description');
        table.decimal('volume_capacity', 10, 2).comment('Capacity in milliliters');
        table.string('material', 100).comment('Material of the container');
        table.string('color', 50).comment('Color of the container');
        table.boolean('is_reusable').defaultTo(false);
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
    // Create test_panels table
    await knex.schema.createTable('test_panels', function (table) {
        table.increments('prim_key').notNullable().primary();
        table.string('name', 255).notNullable().unique();
        table.integer('category').notNullable();
        table.integer('price').notNullable();
        table.datetime('created_on', { precision: 6 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
        table.integer('sample').notNullable();
        table.text('description').nullable();
        table.integer('sample_container', 10).unsigned().notNullable()
            .references('id').inTable('samplecontainer')
            .onUpdate('CASCADE');
        table.string('unit', 10).notNullable();
        table.string('qty_required', 100).nullable();
        table.string('shorttext', 15).nullable();
        table.specificType('iscustom', 'tinyint(1)').notNullable().defaultTo(0);
        table.integer('id', 20).notNullable();
        table.index(['id'], 'id_index');
        table.index(['name', 'id'], 'name_id_index');
    });
    await knex.schema.createTable('setupliteraturereview', function (table) {
        table.increments('id');
        table.integer('testid', 20).notNullable()
            .references("id").inTable("test_panels");
        table.text('literature').nullable();
        table
            .datetime('created_on', { precision: 6 })
            .notNullable()
            .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
        table
            .datetime('updated_on', { precision: 6 })
            .nullable()
            .defaultTo(knex.raw('CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)'));
    });
    await knex.raw(`
    CREATE TRIGGER inserttestdetails 
    AFTER INSERT ON test_panels 
    FOR EACH ROW 
   BEGIN
      INSERT INTO testdetails (testid, testcost) VALUES (NEW.id, NEW.price);
      IF NEW.iscustom = 1 THEN 
         INSERT INTO customtestcreation(testid) VALUES (NEW.id);
      END IF;
      
      INSERT INTO setupliteraturereview (testid) VALUES(NEW.id);
    END
  `);
    // Trigger: AFTER DELETE on test_panels to delete from testdetails and customtestcreation
    await knex.raw(`
    CREATE TRIGGER ontestdelete 
    AFTER DELETE ON test_panels 
    FOR EACH ROW 
    BEGIN
      DELETE FROM testdetails WHERE testid = OLD.id;
      IF OLD.iscustom = 1 THEN 
         DELETE FROM customtestcreation WHERE testid = OLD.id;
      END IF;
    END
  `);
    // Trigger: BEFORE INSERT on test_panels to generate test id
    await knex.raw(`
    CREATE TRIGGER testidgeneration 
    BEFORE INSERT ON test_panels 
    FOR EACH ROW 
    BEGIN
      DECLARE last_id INT DEFAULT 0;
      IF EXISTS (SELECT 1 FROM test_panels LIMIT 1) THEN
        SELECT prim_key INTO last_id FROM test_panels ORDER BY prim_key DESC LIMIT 1;
      END IF;
      SET NEW.id = CONCAT(100, '01', last_id + 1);
    END
  `);
    await knex.raw(`
      CREATE TRIGGER afteriliteraturereview 
      AFTER INSERT ON test_panels 
      FOR EACH ROW 
      BEGIN
          INSERT INTO setupliteraturereview (testid) VALUES (NEW.id);
      END
  `);
};
exports.down = async function (knex) {
    await knex.raw('DROP TRIGGER IF EXISTS testidgeneration');
    await knex.raw('DROP TRIGGER IF EXISTS ontestdelete');
    await knex.raw('DROP TRIGGER IF EXISTS inserttestdetails');
    await knex.raw('DROP TRIGGER IF EXISTS after_test_panels_insert_literature');
    await knex.schema.dropTableIfExists('setupliteraturereview');
    await knex.schema.dropTableIfExists('test_panels');
    await knex.schema.dropTableIfExists('test_categories');
    return knex.schema.dropTableIfExists('samplecontainer');
};
