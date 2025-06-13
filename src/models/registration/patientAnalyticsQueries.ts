export const totalPatients = `
    SELECT COUNT(DISTINCT patientid) AS total_patients 
    FROM patients`;

export const genderDistribution = `
    SELECT gender, COUNT(*) AS count 
    FROM patients 
    GROUP BY gender`;

export const ageDistribution = `
    SELECT 
        CASE 
            WHEN age BETWEEN 0 AND 18 THEN '0-18'
            WHEN age BETWEEN 19 AND 35 THEN '19-35'
            WHEN age BETWEEN 36 AND 50 THEN '36-50'
            ELSE '51+' 
        END AS age_group,
        COUNT(*) AS count
    FROM patients
    GROUP BY age_group`;

export const maritalStatusBreakdown = `
    SELECT marital_status, COUNT(*) AS count 
    FROM patients 
    GROUP BY marital_status`;

export const occupationInsights = `
    SELECT occupation, COUNT(*) AS count 
    FROM patients 
    GROUP BY occupation 
    ORDER BY count DESC`;

export const emailDomainAnalysis = `
    SELECT SUBSTRING_INDEX(email, '@', -1) AS domain, COUNT(*) AS count 
    FROM patients 
    GROUP BY domain`;

export const mobileNumberFormats = `
    SELECT mobile_number, COUNT(*) AS count 
    FROM patients 
    GROUP BY mobile_number 
    HAVING LENGTH(mobile_number) = 10`;

export const whatsappContactAvailability = `
    SELECT COUNT(*) AS count, 
           SUM(CASE WHEN whatAppcontact IS NOT NULL THEN 1 ELSE 0 END) AS whatsapp_available 
    FROM patients`;

export const birthDateDistribution = `
    SELECT MONTH(dob) AS birth_month, COUNT(*) AS count 
    FROM patients 
    GROUP BY birth_month`;

export const patientActivationStatus = `
    SELECT activation_status, COUNT(*) AS count 
    FROM patients 
    GROUP BY activation_status`;

export const recentPatients = `
    SELECT COUNT(*) AS recent_patients 
    FROM patients 
    WHERE date >= NOW() - INTERVAL 1 MONTH`;

export const occupationByAgeGroup = `
    SELECT 
        occupation, 
        CASE 
            WHEN age BETWEEN 0 AND 18 THEN '0-18'
            WHEN age BETWEEN 19 AND 35 THEN '19-35'
            WHEN age BETWEEN 36 AND 50 THEN '36-50'
            ELSE '51+' 
        END AS age_group,
        COUNT(*) AS count
    FROM patients
    GROUP BY occupation, age_group`;

export const commonAgesForOccupation = `
    SELECT occupation, age, COUNT(*) AS count 
    FROM patients 
    GROUP BY occupation, age 
    ORDER BY count DESC`;

export const preferredContactMethod = `
    SELECT contactpointer, COUNT(*) AS count 
    FROM patients 
    GROUP BY contactpointer`;

export const commonNames = `
    SELECT firstname, lastname, COUNT(*) AS count 
    FROM patients 
    GROUP BY firstname, lastname 
    ORDER BY count DESC`;

export const missingDataAnalysis = `
    SELECT 
        COUNT(*) AS total_records,
        SUM(CASE WHEN designation IS NULL THEN 1 ELSE 0 END) AS missing_designation,
        SUM(CASE WHEN occupation IS NULL THEN 1 ELSE 0 END) AS missing_occupation
    FROM patients`;

export const duplicateRecords = `
    SELECT email, COUNT(*) AS count 
    FROM patients 
    GROUP BY email 
    HAVING count > 1`;

export const trendOverTime = `
    SELECT DATE(date) AS registration_date, COUNT(*) AS count 
    FROM patients 
    GROUP BY registration_date 
    ORDER BY registration_date`;

export const ageTrendsOverTime = `
    SELECT YEAR(date) AS year, AVG(age) AS average_age 
    FROM patients 
    GROUP BY year`;

export const ageAndOccupationCorrelation = `
    SELECT age, occupation, COUNT(*) AS count 
    FROM patients 
    GROUP BY age, occupation`;

export const activeVsInactivePatients = `
    SELECT activation_status, COUNT(*) AS count 
    FROM patients 
    GROUP BY activation_status`;

export const durationOfActivation = `
    SELECT 
        DATEDIFF(NOW(), MIN(date)) AS days_since_first_registration 
    FROM patients 
    WHERE activation_status = 'TRUE'`;

export const frequencyOfContact = `
    SELECT contactpointer, COUNT(*) AS count 
    FROM patients 
    GROUP BY contactpointer`;

export const responseRates = `
    SELECT 
        p.patientid, 
        COUNT(r.response_id) AS response_count 
    FROM patients p 
    LEFT JOIN responses r ON p.patientid = r.patientid 
    GROUP BY p.patientid`;

export const comparisonByGender = `
    SELECT gender, AVG(age) AS average_age, COUNT(*) AS count 
    FROM patients 
    GROUP BY gender`;

export const contactMethodEffectiveness = `
    SELECT contactpointer, COUNT(*) AS successful_contacts 
    FROM outreach 
    WHERE status = 'successful' 
    GROUP BY contactpointer`;

export const correlationAnalysis = `
    SELECT age, marital_status, COUNT(*) AS count 
    FROM patients 
    GROUP BY age, marital_status`;

export const meanMedianModeOfAge = `
    SELECT 
        AVG(age) AS mean_age, 
        (SELECT age FROM patients ORDER BY age LIMIT 1 OFFSET (SELECT COUNT(*) FROM patients) / 2) AS median_age,
        (SELECT age FROM patients GROUP BY age ORDER BY COUNT(*) DESC LIMIT 1) AS mode_age
    FROM patients`;

export const distributionOfActivationDates = `
    SELECT DATE(date) AS activation_date, COUNT(*) AS count 
    FROM patients 
    GROUP BY activation_date`;

export const historicalChanges = `
    SELECT year, COUNT(*) AS count 
    FROM historical_patients 
    GROUP BY year`;

export const referralSources = `
    SELECT referral_source, COUNT(*) AS count 
    FROM patients 
    GROUP BY referral_source`;

export const growthRate = `
    SELECT 
        YEAR(date) AS year, 
        COUNT(*) AS count, 
        (COUNT(*) - LAG(COUNT(*)) OVER (ORDER BY YEAR(date))) / LAG(COUNT(*)) OVER (ORDER BY YEAR(date)) AS growth_rate 
    FROM patients 
    GROUP BY year`;

export const firstNameLengthAnalysis = `
    SELECT AVG(LENGTH(firstname)) AS average_first_name_length 
    FROM patients`;

export const designationPatterns = `
    SELECT designation, COUNT(*) AS count 
    FROM patients 
    GROUP BY designation`;

export const growthRateOfPatientRegistrations = `
    SELECT MONTH(date) AS registration_month, COUNT(*) AS count 
    FROM patients 
    GROUP BY registration_month`;

export const testsWithProcessingDelays = (expected_time: number) => `
    SELECT COUNT(*) AS delayed_processing 
    FROM patients 
    WHERE TIMESTAMPDIFF(MINUTE, processingStartDate, processingEndDate) > ${expected_time}`;

export const totalTestsByYear = `
    SELECT YEAR(date) AS year, COUNT(*) AS total_tests 
    FROM patients 
    GROUP BY year`;
