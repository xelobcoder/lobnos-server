export const q_create_new_sms_template = `
  INSERT INTO smstemplate (templateName, placeholders, smscontent, createdby, createdon)
  VALUES (?, ?, ?, ?, ?)
`;

export const q_read_sms_template_by_id = `
  SELECT * FROM smstemplate WHERE tempateid = ?
`;

export const q_update_sms_template = (fields: string[]) => `
  UPDATE smstemplate
  SET ${fields.map((field) => `${field} = ?`).join(', ')}
  WHERE tempateid = ?
`;

export const q_delete_sms_template_by_id = `
  DELETE FROM smstemplate WHERE tempateid = ?
`;
export const q_read_sms_templates_with_pagination = `
  SELECT * FROM smstemplate
  LIMIT ? OFFSET ?
`;

export const q_read_sms_templates_without_pagination = `
  SELECT * FROM smstemplate
`;
export const q_read_sms_messages_with_pagination = `
  SELECT * FROM smsmessages
  LIMIT ? OFFSET ?
`;


export const q_sms_template_count = 'SELECT COUNT(*) AS total FROM smstemplate';

export const q_sms_messages_count = 'SELECT COUNT(*) AS total FROM smsmessages';

export const q_sms_message_insert = `
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

export const q_sms_message_update_resolved = `UPDATE smsmessages
SET  isSent = 1  WHERE messageid = ?`

export const q_sms_message_update = `
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

export const q_sms_message_delete = `
DELETE FROM smsmessages
WHERE 
    messageid = ?;
`;

export const q_sms_message_select = `
SELECT 
    messageid, frequency, message, isTemplateused, templateid, 
    isScheduled, scheduledDate, scheduledTime, endDate, usecase, 
    isSent, templateCategory, isBulk, receipients
FROM 
    smsmessages
WHERE 
    messageid = ?;
`;


export const q_sms_unsent_scheduled_message = ` SELECT * FROM smsmessages WHERE isSent = 0 LIMIT ? OFFSET ?`;


export const q_sms_reached_scheduled_date_an_time_sms_unsent = `SELECT * 
FROM smsmessages 
WHERE (scheduledDate < CURRENT_DATE 
       OR (scheduledDate = CURRENT_DATE AND scheduledTime <= CURRENT_TIME))
  AND isSent = 0 LIMIT ? OFFSET ?;
`



export const q_sms_birthday_clients = `SELECT * FROM new_patients WHERE DATE(dob) = CURRENT_DATE `