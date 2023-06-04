SELECT 
       pt.DATE,
       pt.BILLINGID,
       tt.collection,
       (SELECT COUNT(*) FROM performing_test WHERE DATE = '2023-06-04') AS registered,
       tt.ready,
       tt.collection_date,
       tt.processing,
       tt.testid
        FROM performing_test AS pt
       INNER JOIN BILLING AS b ON b.billingid = pt.billingid
       INNER JOIN test_ascension AS tt ON tt.billingid = b.BILLINGID
       WHERE pt.DATE = '2023-06-04'