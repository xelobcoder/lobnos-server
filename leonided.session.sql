


-- SELECT 
-- pt.DATE,
-- (SELECT COUNT(*) FROM performing_test WHERE DATE = '2023-05-18') AS registered,
-- tt.collection,
-- pt.BILLINGID,
-- pt.PHELOBOTOMY_STATUS,
-- tt.ready,
-- tt.collection_date,
-- tt.processing,
-- tt.testid
--  FROM performing_test AS pt
-- INNER JOIN BILLING AS b ON b.billingid = pt.billingid
-- INNER JOIN test_ascension AS tt ON tt.billingid = b.BILLINGID
-- WHERE pt.DATE = '2023-05-18'



SELECT * from performing_test WHERE DATE ='2023-05-27'