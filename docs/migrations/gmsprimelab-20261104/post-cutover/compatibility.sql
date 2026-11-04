-- Additive compatibility baseline. Review the JSON report and take a verified backup first.

-- Existing column definitions, indexes, triggers and data are retained. Run application bootstrappers afterwards.

-- MySQL DDL commits implicitly. Stop on the first error and regenerate the plan before retrying.

USE `gmsprimelab`;

SET @pls_previous_sql_mode = @@SESSION.sql_mode;

SET SESSION sql_mode = REPLACE(REPLACE(@@SESSION.sql_mode, 'NO_ZERO_DATE', ''), 'NO_ZERO_IN_DATE', '');

SET SESSION sql_mode = @pls_previous_sql_mode;
