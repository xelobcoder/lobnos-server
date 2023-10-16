BEGIN
  DECLARE stock_count INT;
  
  -- Check if the stockid exists in departmentstocks
  SELECT COUNT(*) INTO stock_count
  FROM departmentstocks
  WHERE stockid = NEW.stockid;

  IF NEW.departmentReceived = 1 AND NEW.quantityReceived > 0 THEN
  INSERT INTO departmentconsumption (quantity,stockid,departmentid,lotNo) VALUES (NEW.quantityReceived,OLD.stockid,OLD.departmentid,OLD.lotNo);
  
    IF stock_count > 0 THEN
      -- Stockid exists, update the quantityAvailable
      UPDATE departmentstocks
      SET quantityAvailable = NEW.quantityReceived + quantityAvailable
      WHERE stockid = NEW.stockid AND deptid = OLD.departmentid;
    ELSE
      -- Stockid doesn't exist, insert a new record
      INSERT INTO departmentstocks (stockid, quantityAvailable, deptid, comsumptionunit)
      VALUES (NEW.stockid, NEW.quantityReceived, OLD.departmentid, OLD.comsumptionunit);
    END IF;
    
    -- Update the generalstocks table
    UPDATE generalstocks
    SET quantity = quantity - NEW.quantityReceived
    WHERE stockid = OLD.stockid;
  END IF;
END