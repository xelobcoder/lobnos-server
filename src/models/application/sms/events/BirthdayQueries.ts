export class BirthdayQueries {
     static getTodaysBirthdays = `
          SELECT 
               patientid,
               CONCAT(firstname, ' ', COALESCE(middlename, ''), ' ', lastname) as fullname,
               mobile_number,
               whatAppcontact,
               email,
               DATE_FORMAT(dob, '%M %d') as birthday_date,
               TIMESTAMPDIFF(YEAR, dob, CURDATE()) as current_age
          FROM new_patients
          WHERE 
               DATE_FORMAT(dob, '%m-%d') = DATE_FORMAT(CURDATE(), '%m-%d')
               AND activation_status = 'TRUE'
               AND mobile_number IS NOT NULL
          ORDER BY firstname
          LIMIT ? OFFSET ?
     `;

     static getTodaysBirthdaysCount = `
          SELECT COUNT(*) as total
          FROM new_patients
          WHERE 
               DATE_FORMAT(dob, '%m-%d') = DATE_FORMAT(CURDATE(), '%m-%d')
               AND activation_status = 'TRUE'
               AND mobile_number IS NOT NULL;
     `;

     static getUpcomingBirthdays = `
          SELECT 
               patientid,
               CONCAT(firstname, ' ', COALESCE(middlename, ''), ' ', lastname) as fullname,
               mobile_number,
               whatAppcontact,
               email,
               DATE_FORMAT(dob, '%M %d') as birthday_date,
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
               AND activation_status = 'TRUE'
               AND mobile_number IS NOT NULL
          ORDER BY days_until_birthday
          LIMIT ? OFFSET ?;
     `;

     static getUpcomingBirthdaysCount = `
          SELECT COUNT(*) as total
          FROM new_patients
          WHERE 
               DATE_FORMAT(dob, '%m-%d') BETWEEN 
                    DATE_FORMAT(CURDATE(), '%m-%d') 
                    AND DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 7 DAY), '%m-%d')
               AND activation_status = 'TRUE'
               AND mobile_number IS NOT NULL;
     `;
}