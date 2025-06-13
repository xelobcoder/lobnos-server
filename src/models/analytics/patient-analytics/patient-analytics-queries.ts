export const q_patient_analytics_age_distribution = `
SELECT age, COUNT(*) AS patient_count
FROM new_patients
GROUP BY age
ORDER BY age;
`;

export const q_patient_analytics_gender_distribution = `
SELECT gender, COUNT(*) AS patient_count
FROM new_patients
GROUP BY gender;
`;

export const q_patient_analytics_marital_status = `
SELECT marital_status, COUNT(*) AS patient_count
FROM new_patients
GROUP BY marital_status;
`;

export const q_patient_analytics_patient_registration_over_time = `
SELECT DATE(date) AS registration_date, COUNT(*) AS patient_count
FROM new_patients
GROUP BY DATE(date)
ORDER BY registration_date;
`;

export const q_patient_analytics_activation_status = `
SELECT activation_status, COUNT(*) AS patient_count
FROM new_patients
GROUP BY activation_status;
`;

export const q_patient_analytics_preferred_contact_method = `
SELECT contactpointer, COUNT(*) AS patient_count
FROM new_patients
GROUP BY contactpointer;
`;

export const q_patient_analytics_whatsapp_usage = `
SELECT COUNT(*) AS whatsapp_users
FROM new_patients
WHERE whatAppcontact IS NOT NULL;
`;

export const q_patient_analytics_organization_affiliation = `
SELECT organization, COUNT(*) AS patient_count
FROM new_patients
GROUP BY organization;
`;

export const q_patient_analytics_designation = `
SELECT designation, COUNT(*) AS patient_count
FROM new_patients
GROUP BY designation;
`;

export const q_patient_analytics_name_patterns = `
SELECT firstname, lastname, middlename, COUNT(*) AS name_count
FROM new_patients
GROUP BY firstname, lastname, middlename
ORDER BY name_count DESC;
`;

export const q_patient_analytics_unique_identifiers = `
SELECT fullpatientid, COUNT(*) AS duplicate_count
FROM new_patients
GROUP BY fullpatientid
HAVING COUNT(*) > 1;
`;

export const q_patient_analytics_age_type_analysis = `
SELECT agetype, COUNT(*) AS patient_count
FROM new_patients
GROUP BY agetype;
`;

export const q_patient_analytics_age_group_segmentation = `
SELECT
    CASE 
        WHEN age BETWEEN 0 AND 18 THEN '0-18'
        WHEN age BETWEEN 19 AND 35 THEN '19-35'
        WHEN age BETWEEN 36 AND 50 THEN '36-50'
        ELSE '51+'
    END AS age_group,
    COUNT(*) AS patient_count
FROM new_patients
GROUP BY age_group
ORDER BY age_group;
`;

export const q_patient_analytics_occupation_distribution = `
SELECT occupation, COUNT(*) AS patient_count
FROM new_patients
GROUP BY occupation;
`;

export const q_patient_analytics_occupation_vs_age_gender = `
SELECT occupation, gender, AVG(age) AS average_age
FROM new_patients
GROUP BY occupation, gender;
`;

export const q_patient_analytics_missing_data_analysis = `
SELECT
    COUNT(*) - COUNT(email) AS missing_emails,
    COUNT(*) - COUNT(mobile_number) AS missing_mobile_numbers,
    COUNT(*) - COUNT(middlename) AS missing_middlenames
FROM new_patients;
`;

export const q_patient_analytics_duplicate_records = `
SELECT fullpatientid, email, mobile_number, COUNT(*) AS duplicate_count
FROM new_patients
GROUP BY fullpatientid, email, mobile_number
HAVING COUNT(*) > 1;
`;

export const q_patient_analytics_date_of_birth_analysis = `
SELECT MONTH(dob) AS birth_month, COUNT(*) AS patient_count
FROM new_patients
GROUP BY MONTH(dob)
ORDER BY birth_month;
`;

export const q_patient_analytics_registration_date_vs_activation = `
SELECT
    DATE(date) AS registration_date,
    activation_status,
    COUNT(*) AS patient_count
FROM new_patients
GROUP BY DATE(date), activation_status
ORDER BY registration_date;
`;

export const q_patient_analytics_combined_attributes = `
SELECT gender, marital_status, occupation, COUNT(*) AS patient_count
FROM new_patients
GROUP BY gender, marital_status, occupation;
`;

export const q_patient_analytics_high_value_patients = `
SELECT *
FROM new_patients
WHERE organization IS NOT NULL AND activation_status = 'TRUE';
`;

export const q_patient_analytics_patient_churn_prediction = `
SELECT *
FROM new_patients
WHERE activation_status = 'FALSE' AND DATEDIFF(CURDATE(), date) > 30;
`;

export const q_patient_analytics_age_related_health_risks = `
SELECT
    CASE 
        WHEN age < 18 THEN 'Under 18'
        WHEN age BETWEEN 18 AND 35 THEN '18-35'
        WHEN age BETWEEN 36 AND 50 THEN '36-50'
        ELSE '51+'
    END AS age_group,
    COUNT(*) AS patient_count
FROM new_patients
GROUP BY age_group;
`;

export const q_patient_analytics_dashboards = `
SELECT
    COUNT(*) AS total_patients,
    SUM(CASE WHEN activation_status = 'TRUE' THEN 1 ELSE 0 END) AS active_patients,
    SUM(CASE WHEN gender = 'male' THEN 1 ELSE 0 END) AS male_patients,
    SUM(CASE WHEN gender = 'female' THEN 1 ELSE 0 END) AS female_patients
FROM new_patients;
`;

export const q_patient_analytics_monthly_patient_registration_trend = `
SELECT
    YEAR(date) AS registration_year,
    MONTH(date) AS registration_month,
    COUNT(*) AS patient_count
FROM new_patients
GROUP BY YEAR(date), MONTH(date)
ORDER BY registration_year, registration_month;
`;



export const q_patient_analytics_day_registered_client =`SELECT COUNT(*) AS count FROM new_patients WHERE date = CURRENT_DATE`