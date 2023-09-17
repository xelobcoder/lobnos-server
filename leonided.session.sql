 SELECT
        SUM(PAYABLE) AS salesAmount,
        CASE
            WHEN DAY(pt.DATE) BETWEEN 1 AND 7 THEN 'First Week'
            WHEN DAY(pt.DATE) BETWEEN 8 AND 14 THEN 'Second Week'
            WHEN DAY(pt.DATE) BETWEEN 15 AND 21 THEN 'Third Week'
            WHEN DAY(pt.DATE) BETWEEN 22 AND 31 THEN 'Fourth Week'
        END AS 'Week',
        COUNT(b.BILLINGID) AS totalCases,
        pt.DATE AS DATE
      FROM billing AS b
      INNER JOIN performing_test as pt ON b.BILLINGID = pt.BILLINGID
      WHERE YEAR(pt.DATE) = YEAR(CURDATE())
      AND MONTH(pt.DATE) = MONTH(CURDATE())
      AND pt.PATIENTID = 2023854
      GROUP BY WEEK(pt.DATE)