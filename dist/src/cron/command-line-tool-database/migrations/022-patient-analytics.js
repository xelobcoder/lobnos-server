"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    await knex.raw(`
    CREATE PROCEDURE \`pt_analytics_age_distribution\`(
        IN unit_size INT
    )
    BEGIN
        SELECT
            CONCAT(
                FLOOR(age / unit_size) * unit_size,
                '-',
                FLOOR(age / unit_size) * unit_size + unit_size - 1
            ) AS age_range,
            COUNT(*) AS patient_count
        FROM new_patients
        WHERE age IS NOT NULL AND age >= 0
        GROUP BY age_range
        ORDER BY FLOOR(age / unit_size);
    END
  `);
    await knex.raw(`
    CREATE PROCEDURE \`pt_analytics_daily_registration_summary\`(
        IN start_date DATE,
        IN end_date DATE
    )
    BEGIN
        SELECT
            DATE(date) AS registration_date,
            COUNT(*) AS patient_count
        FROM new_patients
        WHERE DATE(date) BETWEEN start_date AND end_date
        GROUP BY DATE(date)
        ORDER BY registration_date;
    END
  `);
    await knex.raw(`
    CREATE PROCEDURE \`pt_analytics_duplicate_patients\`()
    BEGIN
        SELECT
            fullpatientid,
            email,
            mobile_number,
            COUNT(*) AS duplicate_count
        FROM new_patients
        GROUP BY fullpatientid, email, mobile_number
        HAVING COUNT(*) > 1;
    END
  `);
    await knex.raw(`
    CREATE PROCEDURE \`pt_analytics_missing_fields_summary\`()
    BEGIN
        SELECT
            COUNT(*) - COUNT(email) AS missing_emails,
            COUNT(*) - COUNT(mobile_number) AS missing_mobile_numbers,
            COUNT(*) - COUNT(middlename) AS missing_middlenames
        FROM new_patients;
    END
  `);
    await knex.raw(`
    CREATE PROCEDURE \`pt_analytics_monthly_registration_summary\`()
    BEGIN
        SELECT
            YEAR(date) AS registration_year,
            MONTH(date) AS registration_month,
            COUNT(*) AS patient_count
        FROM new_patients
        GROUP BY YEAR(date), MONTH(date)
        ORDER BY registration_year, registration_month;
    END
  `);
    await knex.raw(`
    CREATE PROCEDURE \`pt_analytics_patient_summary\`()
    BEGIN
        SELECT
            COUNT(*) AS total_patients,
            SUM(CASE WHEN activation_status = 'TRUE' THEN 1 ELSE 0 END) AS active_patients,
            SUM(CASE WHEN gender = 'male' THEN 1 ELSE 0 END) AS male_patients,
            SUM(CASE WHEN gender = 'female' THEN 1 ELSE 0 END) AS female_patients
        FROM new_patients;
    END
  `);
    await knex.raw(`
    CREATE PROCEDURE \`pt_unique_registered_clients\`(
        IN p_start_date DATE,
        IN p_end_date DATE
    )
    BEGIN
        -- Validate date range
        IF p_start_date > p_end_date THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Start date must be before end date';
        ELSE
            SELECT
                COUNT(DISTINCT patientid) AS unique_registered_clients,
                p_start_date AS start_date,
                p_end_date AS end_date
            FROM new_patients
            WHERE date BETWEEN p_start_date AND p_end_date;
        END IF;
    END
  `);
}
exports.up = up;
async function down(knex) {
    await knex.raw('DROP PROCEDURE IF EXISTS `pt_analytics_age_distribution`');
    await knex.raw('DROP PROCEDURE IF EXISTS `pt_analytics_daily_registration_summary`');
    await knex.raw('DROP PROCEDURE IF EXISTS `pt_analytics_duplicate_patients`');
    await knex.raw('DROP PROCEDURE IF EXISTS `pt_analytics_missing_fields_summary`');
    await knex.raw('DROP PROCEDURE IF EXISTS `pt_analytics_monthly_registration_summary`');
    await knex.raw('DROP PROCEDURE IF EXISTS `pt_analytics_patient_summary`');
    await knex.raw('DROP PROCEDURE IF EXISTS `pt_unique_registered_clients`');
}
exports.down = down;
