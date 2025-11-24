import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     await knex.raw(`
    CREATE PROCEDURE \`org_service_commissions\`(
        IN start_date DATETIME,
        IN end_date DATETIME
    )
    BEGIN
        SELECT
            DATE(s.serviceAddedOn) AS service_date,
            o.id AS organization_id,
            o.name AS organization_name,
            o.mobile AS organization_phone,
            o.email AS organization_email,
            COUNT(*) AS total_services,
            SUM(s.totalpayable) AS total_value,
            COALESCE(oi.commission, 0) AS commission_percent,
            ROUND(SUM(s.totalpayable) * (COALESCE(oi.commission, 0) / 100), 2) AS commission_earned
        FROM dboservices s
        INNER JOIN organization o
            ON s.organizationId = o.id
        LEFT JOIN organizationaccountinformation oi
            ON oi.organizationid = o.id
        WHERE
            s.status = 'active'
            AND s.isAdjustment = 0
            AND s.organizationId IS NOT NULL
            AND s.serviceAddedOn >= start_date
            AND s.serviceAddedOn < end_date
        GROUP BY
            service_date,
            o.id,
            o.name,
            o.mobile,
            o.email,
            oi.commission
        ORDER BY
            service_date DESC,
            commission_earned DESC,
            o.id DESC;
    END
  `);
}

export async function down(knex: Knex): Promise<void> {
     await knex.raw('DROP PROCEDURE IF EXISTS `org_service_commissions`');
}