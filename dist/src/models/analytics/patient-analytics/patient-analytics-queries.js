"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.q_patient_analytics_day_registered_client = exports.q_patient_analytics_monthly_patient_registration_trend = exports.q_patient_analytics_dashboards = exports.q_patient_analytics_duplicate_records = exports.q_patient_analytics_missing_data_analysis = exports.q_patient_analytics_occupation_distribution = exports.q_patient_analytics_unique_identifiers = exports.q_patient_analytics_activation_status = exports.q_patient_analytics_patient_registration_over_time = exports.q_patient_analytics_marital_status = exports.q_patient_analytics_gender_distribution = exports.q_patient_analytics_age_distribution = void 0;
exports.q_patient_analytics_age_distribution = `CALL pt_analytics_age_distribution(?)`;
exports.q_patient_analytics_gender_distribution = `
SELECT gender, COUNT(*) AS patient_count
FROM new_patients
GROUP BY gender;
`;
exports.q_patient_analytics_marital_status = `
SELECT marital_status, COUNT(*) AS patient_count
FROM new_patients
GROUP BY marital_status;
`;
exports.q_patient_analytics_patient_registration_over_time = `CALL pt_analytics_daily_registration_summary(?, ?)`;
exports.q_patient_analytics_activation_status = `
SELECT activation_status, COUNT(*) AS patient_count
FROM new_patients
GROUP BY activation_status;
`;
exports.q_patient_analytics_unique_identifiers = `
SELECT fullpatientid, COUNT(*) AS duplicate_count
FROM new_patients
GROUP BY fullpatientid
HAVING COUNT(*) > 1;
`;
exports.q_patient_analytics_occupation_distribution = `
SELECT occupation, COUNT(*) AS patient_count
FROM new_patients
GROUP BY occupation;
`;
exports.q_patient_analytics_missing_data_analysis = `
CALL pt_analytics_missing_fields_summary
`;
exports.q_patient_analytics_duplicate_records = `
CALL pt_analytics_duplicate_patients
`;
exports.q_patient_analytics_dashboards = `
CALL pt_analytics_patient_summary
`;
exports.q_patient_analytics_monthly_patient_registration_trend = `CALL pt_analytics_monthly_registration_summary
`;
exports.q_patient_analytics_day_registered_client = `SELECT COUNT(*) AS count FROM new_patients WHERE date = CURRENT_DATE`;
