SELECT tp.NAME,
  tp.ID,
  tp.PRICE,
  tp.CREATED_ON,
  tp.DESCRIPTION,
  tp.SAMPLE_CONTAINER,
  tp.UNIT,
  tp.QTY_REQUIRED,
  d.department
FROM test_panels AS tp
  INNER JOIN departments AS d ON d.id = tp.CATEGORY
  INNER JOIN sampletype AS s ON s.id = tp.SAMPLE