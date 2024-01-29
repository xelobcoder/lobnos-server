BEGIN 
  -- Declare variables for stock count and batch availability
  DECLARE stock_count INT;
  DECLARE batchAvailable INT;

  -- Check if the stockid exists in departmentstocks
  SELECT COUNT(*) INTO stock_count
  FROM departmentstocks
  WHERE stockid = NEW.stockid AND deptid = NEW.departmentid;
  
  -- Insert into generalstoredebithx debit history so that the main stock will be updated.
  INSERT INTO generalstoredebithx (stockid, brandid, batchnumber, debitdate, departmentid, debitqty)
  VALUES (NEW.stockid, NEW.brandid, NEW.batchnumber, NEW.receivedon, NEW.departmentid, NEW.qty); 

  -- Check if a batch is available in departmentconsumption
  SELECT COUNT(*) INTO batchAvailable
  FROM departmentsmainsupply
  WHERE stockid = NEW.stockid AND departmentid = NEW.departmentid AND batchnumber = NEW.batchnumber;

  IF batchAvailable > 0 THEN
    -- Update existing batch in departmentsmainsupply
    UPDATE departmentsmainsupply
    SET quantity = quantity + NEW.qty
    WHERE stockid = NEW.stockid AND brandid = NEW.brandid AND batchnumber = NEW.batchnumber;
  ELSE 
    -- Insert new batch into departmentsmainsupply
    INSERT INTO departmentsmainsupply (quantity, stockid, departmentid, batchnumber, brandid)
    VALUES (NEW.qty, NEW.stockid, NEW.departmentid, NEW.batchnumber, NEW.brandid);
  END IF;
   
  -- Update department stocks now 
  IF stock_count > 0 THEN
    -- Stockid exists, update the quantityAvailable in departmentstocks
    UPDATE departmentstocks
    SET quantityAvailable = quantityAvailable + NEW.qty
    WHERE stockid = NEW.stockid AND deptid = NEW.departmentid;
  ELSE
    -- Stockid doesn't exist, insert a new record in departmentstocks
    INSERT INTO departmentstocks (stockid, quantityAvailable, deptid)
    VALUES (NEW.stockid, NEW.qty, NEW.departmentid);
  END IF; 
END