BEGIN
  -- Declare variables for stock count and batch availability
  DECLARE stock_count INT;
  DECLARE batchAvailable INT;

  -- Check if the stockid exists in departmentstocks
  SELECT COUNT(*) INTO stock_count
  FROM departmentstocks
  WHERE stockid = NEW.stockid AND deptid = OLD.departmentid;

  -- Check if a batch is available in departmentconsumption
  SELECT COUNT(*) INTO batchAvailable
  FROM departmentsmainsupply WHERE stockid = NEW.stockid AND departmentid = OLD.departmentid

  -- If department received the item and the quantity received is greater than 0
  IF NEW.departmentReceived = 1 AND NEW.quantityReceived > 0 AND OLD.store_supplied
  = 1
   THEN
    -- Update department consumption if a batch is available
    IF batchAvailable > 0 THEN 
      -- Update the quantity in departmentconsumption
      UPDATE departmentsmainsupply SET quantity = NEW.quantityReceived + quantity
      WHERE stockid = NEW.stockid AND departmentid = OLD.departmentid;
    
      -- Update the historical record in departmentconsumptionhx
       
    INSERT INTO departmentconsumptionhx(department,stockid,batchnumber,brand,credit,employeeid) 
    VALUES (OLD.departmentid,NEW.stockid,OLD.batchnumber,OLD.brand,NEW.quantityReceived,NEW.receivingemployee);
    ELSE 
      -- Insert a new record in departmentconsumption if no batch is available
      INSERT INTO departmentsmainsupply (quantity, stockid, departmentid, batchnumber, brand) 
      VALUES (NEW.quantityReceived, OLD.stockid, OLD.departmentid, OLD.batchnumber, OLD.brand);
    END IF;

    -- Update department main stocks if stock_count is greater than 0
    IF stock_count > 0 THEN
      -- Stockid exists, update the quantityAvailable in departmentstocks
      UPDATE departmentstocks
      SET quantityAvailable = NEW.quantityReceived + quantityAvailable
      WHERE stockid = NEW.stockid AND deptid = OLD.departmentid;
    ELSE
      -- Stockid doesn't exist, insert a new record in departmentstocks
      INSERT INTO departmentstocks (stockid, quantityAvailable, deptid, comsumptionunit)
      VALUES (NEW.stockid, NEW.quantityReceived, OLD.departmentid, OLD.comsumptionunit);
    END IF;

    -- Update the generalstocks table
    UPDATE generalstocks
    SET quantity = quantity - NEW.quantityReceived
    WHERE stockid = OLD.stockid;
  END IF;
END