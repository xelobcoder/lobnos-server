"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BirthdayQueries = void 0;
class BirthdayQueries {
}
exports.BirthdayQueries = BirthdayQueries;
BirthdayQueries.getTodaysBirthdays = `
          SELECT 
               patientid,
               CONCAT(firstname, ' ', COALESCE(middlename, ''), ' ', lastname) as fullname,
               mobile_number,
               whatAppcontact,
               email,
               DATE_FORMAT(dob, '%M %d, %Y') as birthday_date,
               TIMESTAMPDIFF(YEAR, dob, CURDATE()) as current_age
          FROM new_patients
          WHERE 
               DATE_FORMAT(dob, '%m-%d') = DATE_FORMAT(CURDATE(), '%m-%d')
               AND mobile_number IS NOT NULL
          ORDER BY firstname
          LIMIT ? OFFSET ?
     `;
BirthdayQueries.getTodaysBirthdaysCount = `
          SELECT COUNT(*) as total
          FROM new_patients
          WHERE 
               DATE_FORMAT(dob, '%m-%d') = DATE_FORMAT(CURDATE(), '%m-%d')
               AND mobile_number IS NOT NULL;
     `;
BirthdayQueries.getUpcomingBirthdays = `
          SELECT 
               patientid,
               CONCAT(firstname, ' ', COALESCE(middlename, ''), ' ', lastname) as fullname,
               mobile_number,
               whatAppcontact,
               email,
               DATE_FORMAT(dob, '%M %d, %Y') as birthday_date,
               TIMESTAMPDIFF(YEAR, dob, CURDATE()) as current_age,
               DATEDIFF(
                    DATE_FORMAT(CONCAT(YEAR(CURDATE()), DATE_FORMAT(dob, '-%m-%d')), '%Y-%m-%d'),
                    CURDATE()
               ) as days_until_birthday
          FROM new_patients
          WHERE 
               DATE_FORMAT(dob, '%m-%d') BETWEEN 
                    DATE_FORMAT(CURDATE(), '%m-%d') 
                    AND DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 7 DAY), '%m-%d')
               AND mobile_number IS NOT NULL
          ORDER BY days_until_birthday
          LIMIT ? OFFSET ?;
     `;
BirthdayQueries.getUpcomingBirthdaysCount = `
          SELECT COUNT(*) as total
          FROM new_patients
          WHERE 
               DATE_FORMAT(dob, '%m-%d') BETWEEN 
                    DATE_FORMAT(CURDATE(), '%m-%d') 
                    AND DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 7 DAY), '%m-%d')
               AND mobile_number IS NOT NULL;
     `;
BirthdayQueries.getWeekBirthdays = `
          SELECT 
               patientid,
               CONCAT(firstname, ' ', COALESCE(middlename, ''), ' ', lastname) as fullname,
               mobile_number,
               whatAppcontact,
               email,
               DATE_FORMAT(dob, '%M %d, %Y') as birthday_date,
               TIMESTAMPDIFF(YEAR, dob, CURDATE()) as current_age,
               DATEDIFF(
                    DATE_FORMAT(CONCAT(YEAR(CURDATE()), DATE_FORMAT(dob, '-%m-%d')), '%Y-%m-%d'),
                    CURDATE()
               ) as days_until_birthday
          FROM new_patients
          WHERE 
               DATE_FORMAT(dob, '%m-%d') BETWEEN 
                    DATE_FORMAT(CURDATE(), '%m-%d') 
                    AND DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 7 DAY), '%m-%d')
               AND mobile_number IS NOT NULL
          ORDER BY days_until_birthday
          LIMIT ? OFFSET ?;
     `;
BirthdayQueries.getWeekBirthdaysCount = `
          SELECT COUNT(*) as total
          FROM new_patients
          WHERE 
               DATE_FORMAT(dob, '%m-%d') BETWEEN 
                    DATE_FORMAT(CURDATE(), '%m-%d') 
                    AND DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 7 DAY), '%m-%d')
               AND mobile_number IS NOT NULL;
     `;
BirthdayQueries.getMonthBirthdays = `
          SELECT 
               patientid,
               CONCAT(firstname, ' ', COALESCE(middlename, ''), ' ', lastname) as fullname,
               mobile_number,
               whatAppcontact,
               email,
               DATE_FORMAT(dob, '%M %d, %Y') as birthday_date,
               TIMESTAMPDIFF(YEAR, dob, CURDATE()) as current_age,
               DATEDIFF(
                    DATE_FORMAT(CONCAT(YEAR(CURDATE()), DATE_FORMAT(dob, '-%m-%d')), '%Y-%m-%d'),
                    CURDATE()
               ) as days_until_birthday
          FROM new_patients
          WHERE 
               dob IS NOT NULL
               AND (
                    DATE_FORMAT(dob, '%m-%d') = DATE_FORMAT(CURDATE(), '%m-%d')
                    OR DATE_FORMAT(dob, '%m-%d') BETWEEN 
                         DATE_FORMAT(CURDATE(), '%m-%d')
                         AND DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 7 DAY), '%m-%d')
                    OR (
                         MONTH(dob) = MONTH(CURDATE())
                         AND YEAR(dob) = YEAR(CURDATE())
                    )
               )
               AND mobile_number IS NOT NULL
          ORDER BY days_until_birthday
          LIMIT ? OFFSET ?;
     `;
BirthdayQueries.getMonthBirthdaysCount = `
          SELECT COUNT(*) as total
          FROM new_patients
          WHERE 
               dob IS NOT NULL
               AND (
                    DATE_FORMAT(dob, '%m-%d') = DATE_FORMAT(CURDATE(), '%m-%d')
                    OR DATE_FORMAT(dob, '%m-%d') BETWEEN 
                         DATE_FORMAT(CURDATE(), '%m-%d')
                         AND DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 7 DAY), '%m-%d')
                    OR (
                         MONTH(dob) = MONTH(CURDATE())
                         AND YEAR(dob) = YEAR(CURDATE())
                    )
               )
               AND mobile_number IS NOT NULL;
     `;
