export const q_application_setting: string = `SELECT * FROM applicationsettings`;

export const q_active_tax = `SELECT * FROM tax WHERE apply = 'Yes'`;

export const q_get_email_pref = "SELECT * FROM emailpreference ORDER BY id DESC LIMIT 1";

export const q_update_general_app_set: string = `INSERT INTO applicationsettings (bulkregistration,fontsize,textcolor,BackgroundColor,DeactivateBilling24hrs,PaidBillsBeforeTransaction,completeFlow,approvalbeforeprinting,emailNotification,includeTax) VALUES (?,?,?,?,?,?,?,?,?,?)`;

export const q_TruncateTable: string = `TRUNCATE TABLE applicationsettings`;

export const q_update_sms_settings: string = "UPDATE applicationsettings SET smsSettings = ?";

export const q_get_sms_settings: string = "SELECT smsSettings FROM applicationsettings";

export const q_truncateEmailPreference: string = "TRUNCATE TABLE emailpreference";

export const q_update_email_preference: string =
  "INSERT INTO emailpreference (registration,result,rejection,approval,transactions,birthday,billing) VALUES (?,?,?,?,?,?,?)";
