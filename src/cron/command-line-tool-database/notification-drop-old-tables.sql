-- Drops legacy notification tables so the latest schema can be recreated cleanly.
-- WARNING: This permanently removes notification data from these tables.

SET FOREIGN_KEY_CHECKS = 0;

-- Current notification module tables
DROP TABLE IF EXISTS `notification_template_versions`;
DROP TABLE IF EXISTS `email_queue_attempts`;
DROP TABLE IF EXISTS `notification_queue`;
DROP TABLE IF EXISTS `notification_event_recipients`;
DROP TABLE IF EXISTS `notification_event_settings`;
DROP TABLE IF EXISTS `notification_template_variables`;
DROP TABLE IF EXISTS `notification_templates`;
DROP TABLE IF EXISTS `notification_events`;

-- Legacy/variant table names seen in older notification drafts
DROP TABLE IF EXISTS `notifications_queue`;
DROP TABLE IF EXISTS `notifications_event_recipients`;
DROP TABLE IF EXISTS `notifications_event_settings`;
DROP TABLE IF EXISTS `notifications_template_variables`;
DROP TABLE IF EXISTS `notifications_templates`;
DROP TABLE IF EXISTS `notifications_events`;
DROP TABLE IF EXISTS `notification_recipients`;
DROP TABLE IF EXISTS `notification_settings`;
DROP TABLE IF EXISTS `notification_variables`;
DROP TABLE IF EXISTS `notification_logs`;
DROP TABLE IF EXISTS `notifications_logs`;
DROP TABLE IF EXISTS `notications`;
DROP TABLE IF EXISTS `notications_queue`;
DROP TABLE IF EXISTS `notication_events`;

SET FOREIGN_KEY_CHECKS = 1;
