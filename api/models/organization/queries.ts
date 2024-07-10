export const INITQUERY = `SUM(payable) AS payable, SUM(discount) AS discountedAmount, COUNT(*) AS referedCases FROM billing WHERE organization = ?`;

export const MONTHLYSALESQUERY = `SELECT ${INITQUERY} AND MONTH(billedon) = MONTH(CURRENT_DATE)`;

export const WEEKLYSALESQUERY = `SELECT 
  CASE 
    WHEN DAY(billedon) > 0 AND DAY(billedon) < 7 THEN 'firstWeek'
    WHEN DAY(billedon) > 7 AND DAY(billedon) <= 14 THEN 'secondweek'
    WHEN DAY(billedon) > 14 AND DAY(billedon) <= 21 THEN 'thirdweek'
    ELSE 'fourthweek'
  END AS weeklySales,
  SUM(payable) AS payable,
  SUM(discount) AS discountedAmount,
  COUNT(billingid) AS referedCases 
  FROM billing WHERE organization = ? AND MONTH(billedon) = MONTH(CURRENT_DATE) GROUP BY weeklySales`;

export const DAILYSALESQUERY = `SELECT DAY(billedon) AS day, ${INITQUERY} AND YEAR(billedon) = YEAR(CURRENT_DATE) GROUP BY DAY(billedon)`;

export const TODAYSALESQUERY = `SELECT ${INITQUERY} AND DAY(billedon) = DAY(CURRENT_DATE)`;

export const YEARLYSALESQUERY = `SELECT SUM(payable) AS payable, SUM(discount) AS discountedAmount, COUNT(billingid) AS referedCases, YEAR(billedon) AS yearlySales FROM billing WHERE organization = ? GROUP BY yearlySales`;
