import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     await knex.raw(`
        CREATE FUNCTION \`inv_generate_purchase_order_number\`()
        RETURNS varchar(100) CHARSET utf8mb4 COLLATE utf8mb4_general_ci
        DETERMINISTIC
        BEGIN
            DECLARE year_prefix VARCHAR(4);
            DECLARE sequence_num INT;
            DECLARE order_num VARCHAR(100);

            SET year_prefix = YEAR(CURDATE());

            -- Get next sequence number for this year
            SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(order_number, '-', -1), '-', 1) AS UNSIGNED)), 0) + 1
            INTO sequence_num
            FROM inv_purchase_orders
            WHERE order_number COLLATE utf8mb4_unicode_ci LIKE CONCAT('ORD-', year_prefix, '-%') COLLATE utf8mb4_unicode_ci;

            SET order_num = CONCAT('ORD-', year_prefix, '-', LPAD(sequence_num, 4, '0'));
            RETURN order_num;
        END
    `);
}

export async function down(knex: Knex): Promise<void> {
     await knex.raw('DROP FUNCTION IF EXISTS `inv_generate_purchase_order_number`');
}
