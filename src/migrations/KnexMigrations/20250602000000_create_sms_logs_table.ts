exports.up = async function(knex) {
    await knex.schema.createTable('sms_logs', table => {
        table.bigIncrements('id').primary();
        
        table.text('sms_content').notNullable();
        
        table.bigInteger('receiver_id').notNullable();
        table.enum('receiver_type', ['outsourcing', 'clients', 'staffs', 'organizations', 'clinicians']).notNullable();
        
        table.datetime('time_sent').defaultTo(knex.fn.now());
        table.datetime('time_delivered').nullable();

        table.boolean('is_event').defaultTo(false);
        table.string('event_name', 255).nullable();
        
        table.integer('year').defaultTo(knex.raw('YEAR(CURRENT_DATE)'));

        table.enum('messagestatus', ['pending', 'sent', 'failed', 'delivered']).defaultTo('pending');

        table.bigInteger('sender_id').nullable();
        table.enum('sender_type', ['system', 'staff', 'admin']).defaultTo('system');

        table.integer('retries').defaultTo(0);
        table.text('error_message').nullable();

        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

        // Indexes
        table.index(['receiver_id', 'receiver_type']);
        table.index(['messagestatus']);
        table.index(['time_sent']);
    });
};

exports.down = async function(knex) {
    await knex.schema.dropTableIfExists('sms_logs');
};