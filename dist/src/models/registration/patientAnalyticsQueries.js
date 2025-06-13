"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.totalTestsByYear = exports.testsWithProcessingDelays = exports.growthRateOfPatientRegistrations = exports.designationPatterns = exports.firstNameLengthAnalysis = exports.growthRate = exports.referralSources = exports.historicalChanges = exports.distributionOfActivationDates = exports.meanMedianModeOfAge = exports.correlationAnalysis = exports.contactMethodEffectiveness = exports.comparisonByGender = exports.responseRates = exports.frequencyOfContact = exports.durationOfActivation = exports.activeVsInactivePatients = exports.ageAndOccupationCorrelation = exports.ageTrendsOverTime = exports.trendOverTime = exports.duplicateRecords = exports.missingDataAnalysis = exports.commonNames = exports.preferredContactMethod = exports.commonAgesForOccupation = exports.occupationByAgeGroup = exports.recentPatients = exports.patientActivationStatus = exports.birthDateDistribution = exports.whatsappContactAvailability = exports.mobileNumberFormats = exports.emailDomainAnalysis = exports.occupationInsights = exports.maritalStatusBreakdown = exports.ageDistribution = exports.genderDistribution = exports.totalPatients = void 0;
exports.totalPatients = `
    SELECT COUNT(DISTINCT patientid) AS total_patients 
    FROM patients`;
exports.genderDistribution = `
    SELECT gender, COUNT(*) AS count 
    FROM patients 
    GROUP BY gender`;
exports.ageDistribution = `
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
exports.maritalStatusBreakdown = `
    SELECT marital_status, COUNT(*) AS count 
    FROM patients 
    GROUP BY marital_status`;
exports.occupationInsights = `
    SELECT occupation, COUNT(*) AS count 
    FROM patients 
    GROUP BY occupation 
    ORDER BY count DESC`;
exports.emailDomainAnalysis = `
    SELECT SUBSTRING_INDEX(email, '@', -1) AS domain, COUNT(*) AS count 
    FROM patients 
    GROUP BY domain`;
exports.mobileNumberFormats = `
    SELECT mobile_number, COUNT(*) AS count 
    FROM patients 
    GROUP BY mobile_number 
    HAVING LENGTH(mobile_number) = 10`;
exports.whatsappContactAvailability = `
    SELECT COUNT(*) AS count, 
           SUM(CASE WHEN whatAppcontact IS NOT NULL THEN 1 ELSE 0 END) AS whatsapp_available 
    FROM patients`;
exports.birthDateDistribution = `
    SELECT MONTH(dob) AS birth_month, COUNT(*) AS count 
    FROM patients 
    GROUP BY birth_month`;
exports.patientActivationStatus = `
    SELECT activation_status, COUNT(*) AS count 
    FROM patients 
    GROUP BY activation_status`;
exports.recentPatients = `
    SELECT COUNT(*) AS recent_patients 
    FROM patients 
    WHERE date >= NOW() - INTERVAL 1 MONTH`;
exports.occupationByAgeGroup = `
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
exports.commonAgesForOccupation = `
    SELECT occupation, age, COUNT(*) AS count 
    FROM patients 
    GROUP BY occupation, age 
    ORDER BY count DESC`;
exports.preferredContactMethod = `
    SELECT contactpointer, COUNT(*) AS count 
    FROM patients 
    GROUP BY contactpointer`;
exports.commonNames = `
    SELECT firstname, lastname, COUNT(*) AS count 
    FROM patients 
    GROUP BY firstname, lastname 
    ORDER BY count DESC`;
exports.missingDataAnalysis = `
    SELECT 
        COUNT(*) AS total_records,
        SUM(CASE WHEN designation IS NULL THEN 1 ELSE 0 END) AS missing_designation,
        SUM(CASE WHEN occupation IS NULL THEN 1 ELSE 0 END) AS missing_occupation
    FROM patients`;
exports.duplicateRecords = `
    SELECT email, COUNT(*) AS count 
    FROM patients 
    GROUP BY email 
    HAVING count > 1`;
exports.trendOverTime = `
    SELECT DATE(date) AS registration_date, COUNT(*) AS count 
    FROM patients 
    GROUP BY registration_date 
    ORDER BY registration_date`;
exports.ageTrendsOverTime = `
    SELECT YEAR(date) AS year, AVG(age) AS average_age 
    FROM patients 
    GROUP BY year`;
exports.ageAndOccupationCorrelation = `
    SELECT age, occupation, COUNT(*) AS count 
    FROM patients 
    GROUP BY age, occupation`;
exports.activeVsInactivePatients = `
    SELECT activation_status, COUNT(*) AS count 
    FROM patients 
    GROUP BY activation_status`;
exports.durationOfActivation = `
    SELECT 
        DATEDIFF(NOW(), MIN(date)) AS days_since_first_registration 
    FROM patients 
    WHERE activation_status = 'TRUE'`;
exports.frequencyOfContact = `
    SELECT contactpointer, COUNT(*) AS count 
    FROM patients 
    GROUP BY contactpointer`;
exports.responseRates = `
    SELECT 
        p.patientid, 
        COUNT(r.response_id) AS response_count 
    FROM patients p 
    LEFT JOIN responses r ON p.patientid = r.patientid 
    GROUP BY p.patientid`;
exports.comparisonByGender = `
    SELECT gender, AVG(age) AS average_age, COUNT(*) AS count 
    FROM patients 
    GROUP BY gender`;
exports.contactMethodEffectiveness = `
    SELECT contactpointer, COUNT(*) AS successful_contacts 
    FROM outreach 
    WHERE status = 'successful' 
    GROUP BY contactpointer`;
exports.correlationAnalysis = `
    SELECT age, marital_status, COUNT(*) AS count 
    FROM patients 
    GROUP BY age, marital_status`;
exports.meanMedianModeOfAge = `
    SELECT 
        AVG(age) AS mean_age, 
        (SELECT age FROM patients ORDER BY age LIMIT 1 OFFSET (SELECT COUNT(*) FROM patients) / 2) AS median_age,
        (SELECT age FROM patients GROUP BY age ORDER BY COUNT(*) DESC LIMIT 1) AS mode_age
    FROM patients`;
exports.distributionOfActivationDates = `
    SELECT DATE(date) AS activation_date, COUNT(*) AS count 
    FROM patients 
    GROUP BY activation_date`;
exports.historicalChanges = `
    SELECT year, COUNT(*) AS count 
    FROM historical_patients 
    GROUP BY year`;
exports.referralSources = `
    SELECT referral_source, COUNT(*) AS count 
    FROM patients 
    GROUP BY referral_source`;
exports.growthRate = `
    SELECT 
        YEAR(date) AS year, 
        COUNT(*) AS count, 
        (COUNT(*) - LAG(COUNT(*)) OVER (ORDER BY YEAR(date))) / LAG(COUNT(*)) OVER (ORDER BY YEAR(date)) AS growth_rate 
    FROM patients 
    GROUP BY year`;
exports.firstNameLengthAnalysis = `
    SELECT AVG(LENGTH(firstname)) AS average_first_name_length 
    FROM patients`;
exports.designationPatterns = `
    SELECT designation, COUNT(*) AS count 
    FROM patients 
    GROUP BY designation`;
exports.growthRateOfPatientRegistrations = `
    SELECT MONTH(date) AS registration_month, COUNT(*) AS count 
    FROM patients 
    GROUP BY registration_month`;
const testsWithProcessingDelays = (expected_time) => `
    SELECT COUNT(*) AS delayed_processing 
    FROM patients 
    WHERE TIMESTAMPDIFF(MINUTE, processingStartDate, processingEndDate) > ${expected_time}`;
exports.testsWithProcessingDelays = testsWithProcessingDelays;
exports.totalTestsByYear = `
    SELECT YEAR(date) AS year, COUNT(*) AS total_tests 
    FROM patients 
    GROUP BY year`;
