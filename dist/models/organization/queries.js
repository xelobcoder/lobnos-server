"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YEARLYSALESQUERY = exports.TODAYSALESQUERY = exports.DAILYSALESQUERY = exports.WEEKLYSALESQUERY = exports.MONTHLYSALESQUERY = exports.INITQUERY = void 0;
exports.INITQUERY = `SUM(payable) AS payable, SUM(discount) AS discountedAmount, COUNT(*) AS referedCases FROM billing WHERE organization = ?`;
exports.MONTHLYSALESQUERY = `SELECT ${exports.INITQUERY} AND MONTH(billedon) = MONTH(CURRENT_DATE)`;
exports.WEEKLYSALESQUERY = `SELECT 
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
exports.DAILYSALESQUERY = `SELECT DAY(billedon) AS day, ${exports.INITQUERY} AND YEAR(billedon) = YEAR(CURRENT_DATE) GROUP BY DAY(billedon)`;
exports.TODAYSALESQUERY = `SELECT ${exports.INITQUERY} AND DAY(billedon) = DAY(CURRENT_DATE)`;
exports.YEARLYSALESQUERY = `SELECT SUM(payable) AS payable, SUM(discount) AS discountedAmount, COUNT(billingid) AS referedCases, YEAR(billedon) AS yearlySales FROM billing WHERE organization = ? GROUP BY yearlySales`;
