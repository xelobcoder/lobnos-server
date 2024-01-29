BEGIN 

IF NEW.status = 'received' THEN 
  INSERT INTO departmentrequisitionhx(stockid,brandid,batchnumber,status,qty,
requisitionid,receivedon,departmentid) VALUES(
    OLD.stockid,OLD.brandid,OLD.batchnumber,NEW.status,NEW.qty,OLD.requisitionid,NEW.receivedon,OLD.departmentid);
 END IF;


END;