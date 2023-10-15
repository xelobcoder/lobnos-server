const updateRequisitionAfterReceivedDept = async function (request, response) {
  const { quantityReceived, departmentReceived, id, status, stockid, consumptionunit, departmentid } = request.body;
  if (!quantityReceived || !departmentReceived || !id) {
    response.send({
      status: "error",
      message: "required fields not included",
    });
  } else {
    // this updates `quantityReceived` and `departmentReceived` fields
    const updatingQtyReceived = async function (id, qtyR, dptR) {
      const update_query = `UPDATE departmentrequisitionhx 
       SET quantityReceived = ${qtyR}, departmentReceived = ${dptR}, 
       status = '${status}' WHERE id = ${id}`;

      const updatedQty = new Promise((resolve, reject) => {
        connection.query(update_query, function (err, result) {
          if (err) {
            reject(err);
          }
          if (result) {
            // return the stockid o the stock updated
            resolve(result.affectedRows);
          }
        });
      }
      );

      return updatedQty;
    }
  }


  // added my sql triggers and that solve the problem solved by the bulkk code

  //   DELIMITER $$

  // CREATE TRIGGER update_stocks
  // AFTER INSERT ON your_table_name -- Replace with your actual table name
  // FOR EACH ROW
  // BEGIN
  //   DECLARE stock_count INT;

  //   -- Check if the stockid exists in departmentstocks
  //   SELECT COUNT(*) INTO stock_count
  //   FROM departmentstocks
  //   WHERE stockid = NEW.stockid;

  //   IF NEW.departmentReceived = 1 AND NEW.quantityReceived > 0 THEN
  //     IF stock_count > 0 THEN
  //       -- Stockid exists, update the quantityAvailable
  //       UPDATE departmentstocks
  //       SET quantityAvailable = NEW.quantityReceived + quantityAvailable
  //       WHERE stockid = NEW.stockid AND deptid = OLD.departmentid;
  //     ELSE
  //       -- Stockid doesn't exist, insert a new record
  //       INSERT INTO departmentstocks (stockid, quantityAvailable, deptid, consumptionunit)
  //       VALUES (NEW.stockid, NEW.quantityReceived, OLD.departmentid, OLD.consumptionunit);
  //     END IF;

  //     -- Update the generalstocks table
  //     UPDATE generalstocks
  //     SET quantity = quantity - NEW.quantityReceived
  //     WHERE stockid = OLD.stockid;
  //   END IF;
  // END;
  // $$

  // DELIMITER ;

}