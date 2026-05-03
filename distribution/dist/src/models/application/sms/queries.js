"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.q_sms_birthday_clients = exports.q_sms_reached_scheduled_date_an_time_sms_unsent = exports.q_sms_unsent_scheduled_message = exports.q_sms_message_select = exports.q_sms_message_delete = exports.q_sms_message_update = exports.q_sms_message_update_resolved = exports.q_sms_message_insert = exports.q_sms_messages_count = exports.q_sms_template_count = exports.q_read_sms_messages_with_pagination = exports.q_read_sms_templates_without_pagination = exports.q_read_sms_templates_with_pagination = exports.q_delete_sms_template_by_id = exports.q_update_sms_template = exports.q_read_sms_template_by_id = exports.q_create_new_sms_template = void 0;
exports.q_create_new_sms_template = `
  INSERT INTO smstemplate (templateName, placeholders, smscontent, createdby, createdon)
  VALUES (?, ?, ?, ?, ?)
`;
exports.q_read_sms_template_by_id = `
  SELECT * FROM smstemplate WHERE tempateid = ?
`;
const q_update_sms_template = (fields) => `
  UPDATE smstemplate
  SET ${fields.map((field) => `${field} = ?`).join(', ')}
  WHERE tempateid = ?
`;
exports.q_update_sms_template = q_update_sms_template;
exports.q_delete_sms_template_by_id = `
  DELETE FROM smstemplate WHERE tempateid = ?
`;
exports.q_read_sms_templates_with_pagination = `
  SELECT * FROM smstemplate
  LIMIT ? OFFSET ?
`;
exports.q_read_sms_templates_without_pagination = `
  SELECT * FROM smstemplate
`;
exports.q_read_sms_messages_with_pagination = `
  SELECT * FROM smsmessages
  LIMIT ? OFFSET ?
`;
exports.q_sms_template_count = 'SELECT COUNT(*) AS total FROM smstemplate';
exports.q_sms_messages_count = 'SELECT COUNT(*) AS total FROM smsmessages';
exports.q_sms_message_insert = `
INSERT INTO smsmessages (
    frequency, message, isTemplateused, templateid, isScheduled, 
    scheduledDate, scheduledTime, endDate, usecase, isSent, 
    templateCategory, isBulk, receipients
) VALUES (
    ?, ?, ?, ?, ?, 
    ?, ?, ?, ?, ?, 
    ?, ?, ?
);
`;
exports.q_sms_message_update_resolved = `UPDATE smsmessages
SET  isSent = 1  WHERE messageid = ?`;
exports.q_sms_message_update = `
UPDATE smsmessages
SET 
    frequency = ?, 
    message = ?, 
    isTemplateused = ?, 
    templateid = ?, 
    isScheduled = ?, 
    sheduledDate = ?, 
    scheduledTime = ?, 
    endDate = ?, 
    usecase = ?, 
    isSent = ?, 
    templateCategory = ?, 
    isBulk = ?, 
    receipients = ?
WHERE 
    messageid = ?;
`;
exports.q_sms_message_delete = `
DELETE FROM smsmessages
WHERE 
    messageid = ?;
`;
exports.q_sms_message_select = `
SELECT 
    messageid, frequency, message, isTemplateused, templateid, 
    isScheduled, scheduledDate, scheduledTime, endDate, usecase, 
    isSent, templateCategory, isBulk, receipients
FROM 
    smsmessages
WHERE 
    messageid = ?;
`;
exports.q_sms_unsent_scheduled_message = ` SELECT * FROM smsmessages WHERE isSent = 0 LIMIT ? OFFSET ?`;
exports.q_sms_reached_scheduled_date_an_time_sms_unsent = `SELECT * 
FROM smsmessages 
WHERE (scheduledDate < CURRENT_DATE 
       OR (scheduledDate = CURRENT_DATE AND scheduledTime <= CURRENT_TIME))
  AND isSent = 0 LIMIT ? OFFSET ?;
`;
exports.q_sms_birthday_clients = `SELECT * FROM new_patients WHERE DATE(dob) = CURRENT_DATE `;
