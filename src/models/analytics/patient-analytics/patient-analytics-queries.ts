export const q_patient_analytics_age_distribution = `
WITH params AS (SELECT ? as unit_size, ? as min_age, ? as max_age)
SELECT
    CONCAT(
        FLOOR(age / p.unit_size) * p.unit_size,
        '-',
        FLOOR(age / p.unit_size) * p.unit_size + p.unit_size - 1
    ) AS age_range,
    COUNT(*) AS patient_count
FROM new_patients
CROSS JOIN params p
WHERE age IS NOT NULL AND age >= p.min_age AND age <= p.max_age
GROUP BY age_range
ORDER BY FLOOR(age / p.unit_size);
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
SELECT
    DATE(date) AS registration_date,
    COUNT(*) AS patient_count
FROM new_patients
WHERE date >= DATE(?) AND date < DATE_ADD(DATE(?), INTERVAL 1 DAY)
GROUP BY DATE(date)
ORDER BY registration_date;
`;

export const q_patient_analytics_activation_status = `
SELECT activation_status, COUNT(*) AS patient_count
FROM new_patients
GROUP BY activation_status;
`;




export const q_patient_analytics_unique_identifiers = `
SELECT fullpatientid, COUNT(*) AS duplicate_count
FROM new_patients
GROUP BY fullpatientid
HAVING COUNT(*) > 1;
`;


export const q_patient_analytics_occupation_distribution = `
SELECT occupation, COUNT(*) AS patient_count
FROM new_patients
GROUP BY occupation;
`;


export const q_patient_analytics_missing_data_analysis = `
SELECT
    COUNT(*) - COUNT(email) AS missing_emails,
    COUNT(*) - COUNT(mobile_number) AS missing_mobile_numbers,
    COUNT(*) - COUNT(middlename) AS missing_middlenames
FROM new_patients;
`;

export const q_patient_analytics_duplicate_records = `
SELECT
    fullpatientid,
    email,
    mobile_number,
    COUNT(*) AS duplicate_count
FROM new_patients
GROUP BY fullpatientid, email, mobile_number
HAVING COUNT(*) > 1;
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



export const q_patient_analytics_day_registered_client = `SELECT COUNT(*) AS count FROM new_patients WHERE date = CURRENT_DATE`;

export const q_patient_analytics_registration_by_day_of_week = `
SELECT DAYNAME(date) as day, COUNT(*) as registrations
FROM new_patients
GROUP BY DAYOFWEEK(date), DAYNAME(date)
ORDER BY DAYOFWEEK(date);
`;

export const q_patient_analytics_contact_completeness = `
SELECT
    COUNT(*) as total,
    SUM(CASE WHEN email IS NOT NULL AND mobile_number IS NOT NULL THEN 1 ELSE 0 END) as complete_contact
FROM new_patients;
`;

export const q_patient_analytics_staff_registration_performance = `
SELECT 
    'Staff tracking not available' as message,
    COUNT(*) as total_patients
FROM new_patients;
`;

export const q_patient_analytics_staff_registration_trends = `
SELECT 
    'Staff tracking not available' as message,
    DATE(date) as registration_date,
    COUNT(*) as daily_registrations
FROM new_patients
WHERE DATE(date) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
GROUP BY DATE(date)
ORDER BY registration_date;
`;