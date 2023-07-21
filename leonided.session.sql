SELECT DISTINCT NAME,
  SAMPLE,
  t.collection,
  t.testid,
  t.billingid
from test_ascension AS t
  INNER JOIN test_panels AS tt ON tt.ID = t.testid
  INNER JOIN samplestatus AS ss ON ss.testid = t.testid
WHERE t.billingid = ?
  AND t.collection = 'true'
  AND ss.approvalstatus = 0