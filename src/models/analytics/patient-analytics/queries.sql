-- Demographic Analysis
-- Age Distribution
SELECT age, COUNT(*) AS patient_count
FROM new_patients
GROUP BY age
ORDER BY age;

-- Gender Distribution
SELECT gender, COUNT(*) AS patient_count
FROM new_patients
GROUP BY gender;

-- Marital Status
SELECT marital_status, COUNT(*) AS patient_count
FROM new_patients
GROUP BY marital_status;

-- Patient Growth and Registration Trends
-- Patient Registration Over Time
SELECT DATE(date) AS registration_date, COUNT(*) AS patient_count
FROM new_patients
GROUP BY DATE(date)
ORDER BY registration_date;

-- Activation Status
SELECT activation_status, COUNT(*) AS patient_count
FROM new_patients
GROUP BY activation_status;

-- Contact and Communication Analysis
-- Preferred Contact Method
SELECT contactpointer, COUNT(*) AS patient_count
FROM new_patients
GROUP BY contactpointer;

-- WhatsApp Usage
SELECT COUNT(*) AS whatsapp_users
FROM new_patients
WHERE whatAppcontact IS NOT NULL;

-- Geographic and Organizational Insights
-- Organization Affiliation
SELECT organization, COUNT(*) AS patient_count
FROM new_patients
GROUP BY organization;

-- Designation
SELECT designation, COUNT(*) AS patient_count
FROM new_patients
GROUP BY designation;

-- Name and Identity Analysis
-- Name Patterns
SELECT firstname, lastname, middlename, COUNT(*) AS name_count
FROM new_patients
GROUP BY firstname, lastname, middlename
ORDER BY name_count DESC;

-- Unique Identifiers
SELECT fullpatientid, COUNT(*) AS duplicate_count
FROM new_patients
GROUP BY fullpatientid
HAVING COUNT(*) > 1;

-- Age - Related Insights
-- Age Type Analysis
SELECT agetype, COUNT(*) AS patient_count
FROM new_patients
GROUP BY agetype;

-- Age Group Segmentation
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

-- Occupational Analysis
-- Occupation Distribution
SELECT occupation, COUNT(*) AS patient_count
FROM new_patients
GROUP BY occupation;

-- Occupation vs.Age / Gender
SELECT occupation, gender, AVG(age) AS average_age
FROM new_patients
GROUP BY occupation, gender;

-- Data Quality and Completeness
-- Missing Data Analysis
SELECT
COUNT(*) - COUNT(email) AS missing_emails,
     COUNT(*) - COUNT(mobile_number) AS missing_mobile_numbers,
          COUNT(*) - COUNT(middlename) AS missing_middlenames
FROM new_patients;

-- Duplicate Records
SELECT fullpatientid, email, mobile_number, COUNT(*) AS duplicate_count
FROM new_patients
GROUP BY fullpatientid, email, mobile_number
HAVING COUNT(*) > 1;

-- Temporal Analysis
-- Date of Birth Analysis
SELECT MONTH(dob) AS birth_month, COUNT(*) AS patient_count
FROM new_patients
GROUP BY MONTH(dob)
ORDER BY birth_month;

-- Registration Date vs.Activation
SELECT
DATE(date) AS registration_date,
     activation_status,
     COUNT(*) AS patient_count
FROM new_patients
GROUP BY DATE(date), activation_status
ORDER BY registration_date;

-- Custom Segmentation
-- Combined Attributes
SELECT gender, marital_status, occupation, COUNT(*) AS patient_count
FROM new_patients
GROUP BY gender, marital_status, occupation;

-- High - Value Patients
SELECT *
     FROM new_patients
WHERE organization IS NOT NULL AND activation_status = 'TRUE';

-- Predictive Analytics
-- Patient Churn Prediction
SELECT *
     FROM new_patients
WHERE activation_status = 'FALSE' AND DATEDIFF(CURDATE(), date) > 30;

-- Age - Related Health Risks
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

-- Reporting and Visualization
-- Dashboards
SELECT
COUNT(*) AS total_patients,
     SUM(CASE WHEN activation_status = 'TRUE' THEN 1 ELSE 0 END) AS active_patients,
          SUM(CASE WHEN gender = 'male' THEN 1 ELSE 0 END) AS male_patients,
               SUM(CASE WHEN gender = 'female' THEN 1 ELSE 0 END) AS female_patients
FROM new_patients;

-- Trend Reports
-- Monthly patient registration trend
SELECT
YEAR(date) AS registration_year,
     MONTH(date) AS registration_month,
          COUNT(*) AS patient_count
FROM new_patients
GROUP BY YEAR(date), MONTH(date)
ORDER BY registration_year, registration_month;
