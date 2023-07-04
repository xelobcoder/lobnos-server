SELECT 
o.productordersid,
       o.stockid,
       ns.quantity,
       o.expirydate,
       o.received,
       o.receiveddate,
       o.Batchnumber,
       o.name,
       o.suppliername,
       o.purchaseunit
FROM ORDERS AS o
JOIN newstock AS ns ON o.stockid = ns.stockid
WHERE received = 'TRUE'
  AND DATE(expirydate) < DATE(NOW())
ORDER BY expirydate ASC
LIMIT 100;
