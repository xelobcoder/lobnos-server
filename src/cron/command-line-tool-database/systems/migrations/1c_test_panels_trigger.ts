import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
     // Create trigger for auto-generating test_panels IDs with "100" prefix
     const triggerSQL = `
    CREATE TRIGGER before_insert_test_panels_id
    BEFORE INSERT ON test_panels
    FOR EACH ROW
    BEGIN
      DECLARE last_id INT DEFAULT 101;
      DECLARE max_id INT;
      
      -- Get the highest numeric part of existing IDs
      SELECT MAX(CAST(SUBSTRING(id, 4) AS UNSIGNED)) INTO max_id
      FROM test_panels
      WHERE id LIKE '100%' AND id REGEXP '^100[0-9]+$';
      
      -- If valid IDs found, use the max + 1
      IF max_id IS NOT NULL AND max_id >= 101 THEN
        SET last_id = max_id;
      END IF;
      
      -- Find the first available ID if there are gaps
      SET last_id = last_id + 1;
      
      -- Ensure the ID doesn't already exist (in case of gaps or manual inserts)
      WHILE EXISTS (SELECT 1 FROM test_panels WHERE id = CONCAT('100', last_id)) DO
        SET last_id = last_id + 1;
      END WHILE;
      
      -- Set the new ID
      SET NEW.id = CONCAT('100', last_id);
    END
  `;

     await knex.raw(triggerSQL);
}

export async function down(knex: Knex): Promise<void> {
     // Drop the trigger on rollback
     await knex.raw("DROP TRIGGER IF EXISTS before_insert_test_panels_id");
}
