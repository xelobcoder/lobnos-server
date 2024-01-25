const connection = require("../db");
const logger = require("../../logger");
const { promisifyQuery, customError } = require("../../helper");
const Inventory = require("./Inventory/inventoryclass");

/**
 * Handles a POST request to create a new department requisition.
 * 
 * @param {object} request - The HTTP request object containing the request body.
 * @param {object} response - The HTTP response object used to send the response back to the client.
 * @returns {void}
 */
// Summary
// This code defines a function called newdepartmentRequisition that handles a POST request to create a new department requisition. 
// It checks if all the required fields are provided in the request body, and if not, it sends an error response. 
// If all the fields are provided, it checks if the stock has already been requisitioned for the given department. 
// If it has, it sends a success response indicating that the stock has already been requisitioned. 
// If the stock has not been requisitioned, it inserts a new department requisition into the database and sends a success response with the inserted data.

//    Flow
// Destructure the stockid, departmentid, quantity, and comsumptionunit from the request body.
// Generate a unique requisitionid using the uuidv4 function.
// Check if any of the required fields in the request body are empty or null.
// If any of the required fields are empty or null, send a 400 error response indicating that all fields are required.
// If all the required fields are provided, check if the stock has already been requisitioned for the given department.
// If the stock has already been requisitioned, send a success response indicating that the stock has already been requisitioned.
// If the stock has not been requisitioned, insert a new department requisition into the database.
// Send a success response with the inserted data.
const newdepartmentRequisition = (request, response) => {
  const { stockid, departmentid, quantity, comsumptionunit, employeeid } = request.body;

  const isNotEmptyFields = Object.values(request.body).filter((field) => {
    return field === "" || field === null;
  });

  if (isNotEmptyFields.length > 0) return customError({ message: 'all fields are required', statusCode: 404, response }); 


    const checkIfStockIsAlreadyRequisitioned = async () => {
      const query = `SELECT * FROM departmentrequisition
       WHERE stockid = ? AND departmentid = ? AND quantity_approved IS NULL`;
      try {
        return await promisifyQuery(query, [stockid, departmentid]);
      } catch (error) {
        logger.error(error);
        throw error;
      }
    };

    checkIfStockIsAlreadyRequisitioned()
      .then((data) => {
        if (data.length > 0) {
          response.send({
            statusCode: 200,
            status: "success",
            message: "Stock has already been requisitioned",
          });
        } else {
          const newdepartmentRequisition = async () => {
            const sql_query = `INSERT INTO departmentrequisition
          (stockid, departmentid, quantity_requested, comsumptionunit,requestingemployee)
          VALUES (?,?,?,?,?,?)`;

            try {
              const result = await promisifyQuery(sql_query, [
                stockid,
                departmentid,
                quantity,
                comsumptionunit,
                employeeid
              ]);
              return result;
            } catch (error) {
              throw error;
            }
          };

          newdepartmentRequisition()
            .then((data) => {
              response.send({
                statusCode: 200,
                status: "success",
                message: "Department requisition added successfully",
                data,
              });
            })
            .catch((error) => {
              response.send({
                statusCode: 500,
                status: "error",
                message: "Department requisition not added",
                error,
              });
            });
        }
      })
      .catch((error) => {
        response.send({
          statusCode: 500,
          status: "error",
          message: "Error checking if stock is already requisitioned",
          error,
        });
      });
  }
const getDepartmentsRequisitions = async function (request, response) {
  const query = `
    SELECT *
    FROM departmentrequisition
    ORDER BY id DESC
    LIMIT 20;
  `;

  connection.query(query, (error, results) => {
    if (error) {
      logger.error('Error fetching department requisitions:', error);
      response.status(500).json({
        status: 'error',
        message: 'Failed to fetch department requisitions',
        data: error,
      });
    } else {
      response.status(200).json({
        status: 'success',
        message: 'Department requisitions retrieved successfully',
        data: results,
      });
    }
  });
};

const specificDepartmentRequisition = async function (request, response) {
  const { id, type } = request.query;
  // join department requisition table with  name of department  table and name of newstock table
  if (!id) return new Error('id required');

  let mysql_query = `SELECT  drh.id,
        drh.departmentid, 
        drh.stockid, 
        drh.quantity_requested,
        drh.quantity_approved,
        drh.status,
         drh.date,
         drh.requisitionid,
         drh.comsumptionunit,
         d.department,ns.stockid,
         ns.name,
         ns.quantity
         FROM departmentrequisition AS drh
        INNER JOIN departments AS d ON d.id = drh.departmentid
        INNER JOIN generalstocks AS ns ON ns.stockid = drh.stockid`


  if (type === "pending") {
    mysql_query += ` WHERE drh.departmentid = ? AND quantity_approved IS NULL `
  }

  if (type === "approved") {
    mysql_query += ` WHERE drh.departmentid = ? AND quantity_approved IS NOT NULL AND status = 'approved'`
  }

  if (type === "rejected") {
    mysql_query += ` WHERE drh.departmentid = ? AND quantity_approved IS NOT NULL AND status = 'rejected'`
  }

  if (type === "received") {
    mysql_query += `WHERE drh.departmentid = ? AND quantity_approved IS NOT NULL AND status = 'received'`
  }

  return promisifyQuery(mysql_query,[parseInt(id)]);
};


const patchRequisition = async function (request, response, requi_id) {
  // update the department requisition table with the quantity approved and the status=approved
  const { quantity_approved, store_supplied, brand, batchnumber } = request.body;
  const mysql_query = `UPDATE departmentrequisition
   SET quantity_approved = ?,
   store_supplied = ?,
   batchnumber = ?,
   brand = ?,
   status = 'approved' WHERE id = ?`;

  const values = [quantity_approved, store_supplied, batchnumber, brand, parseInt(requi_id)];

  if (departmentid) {
    response.send({
      status: "error",
      message: "required fields not included",
    });
  } else {
    connection.query(mysql_query, values, function (err, result) {
      if (err) {
        response.send({
          status: "error",
          message: err.message,
        });
      }

      if (result) {
        response.send({
          status: "success",
          message: "success",
          data: result,
          statusCode: 200,
        });
      }
    })
  }
}

const getDeptStocks = async function (request, response, id) {
  const mysql_query = `SELECT 
  np.stockid,np.name,ds.quantityAvailable,sc.category,np.consumptionunit FROM generalstocks 
  AS np INNER JOIN departmentstocks AS
  ds ON np.stockid = ds.stockid INNER 
  JOIN departments AS d ON d.id = ds.deptid 
  INNER JOIN stockcategory AS sc On sc.id = np.category
  WHERE ds.deptid = ${id} `;

  if (id === undefined || id === null) {
    response.send({
      status: "error",
      message: "department id not included",
    });
  } else {
    connection.query(mysql_query, function (err, result) {
      if (err) {
        logger.error(err)
        response.send({
          status: "error",
          message: err.message,
        });
      }

      if (result) {
        response.send({
          status: "success",
          message: "success",
          result,
        });
      }
    });
  }
};

const deleteDeptStocks = async function (request, response, id) {
  // delete stock from department stock table using the stockid
  const mysql_query = `DELETE FROM departmentstocks WHERE stockid = ${id}`;

  if (id === undefined || id === null) {
    response.send({
      status: "error",
      message: "stock id not included",
    });
  } else {
    connection.query(mysql_query, function (err, result) {
      if (err) {
        response.send({
          status: "error",
          message: err.message,
        });
      }

      if (result) {
        response.send({
          status: "success",
          message: "Stock deleted successfully",
          result,
        });
      }
    });
  }
};


// -------------------------

const updateRequisitionAfterReceivedDept = async function (request, response) {
  const { quantityReceived, departmentReceived, id, status, stockid, consumptionunit, departmentid, employeeid } = request.body;

  if (!quantityReceived || !departmentReceived || !id || !employeeid) {
    response.send({
      status: "error",
      message: "required fields not included",
      requiredfields: 'quantityReceived, departmentReceived, id, status, stockid, consumptionunit, departmentid, employeeid'
    });
  }
  else {
    // this updates `quantityReceived` and `departmentReceived` fields
    const update_query = `UPDATE departmentrequisition
       SET quantityReceived = ?, departmentReceived = ?, 
       status = ?, receivingemployee = ? WHERE id = ?`;

    const values = [quantityReceived, departmentReceived, status, employeeid, id];

    const { affectedRows } = await promisifyQuery(update_query, values);

    // rest of the funtions and jobs will be handled at the database level using triggers on department...hx table
    if (!affectedRows || affectedRows === 0) {
      customError('update failed', 500, response);
    } else {
      response.send({
        status: "success",
        message: "Department stocks successfully updated",
        statusCode: 200
      });
    }
  }


};




const generalStoreLotNo = async (request, response) => {
  const { stockidx } = request.query

  if (!stockidx) throw new Error("list of store ids required")
  let _this = {}

  const stockid_collection = stockidx.split(",").map((item) => parseInt(item))
  if (stockid_collection.length === 0) return []

    const inventory = new Inventory()
    const outPromise =  (data) =>  Promise.all(data)
    const stockBrandsArray = stockid_collection.map(async (a, i) => {
      // get individual stocks brands using their id (s).
      const data = await inventory.getAstockBrands({ stockid: a })
      const stkbrand = data.map((x, y) => {return x?.brandid})
      return { stockid: a, brands: stkbrand }
    })

    const stocksbrands = await outPromise(stockBrandsArray)
    const haveBrands = stocksbrands.filter((a, i) => a.brands.length > 0);


    let products = []

    if (haveBrands.length > 0) {
      products = haveBrands.map(async (u, v) => {
        const { stockid, brands } = u
        const debithx = await promisifyQuery(`SELECT * FROM generalstoredebithx WHERE stockid = ${stockid} AND brandid IN (${brands.join(",")})`);
        return  {...u, debithx}
      });

      products = (await outPromise(products));
   
      // if debit hx is empty,it means the credit stock hasnt been used so we send the credit hx

      products = products.map(async (v, i) => {
        const { debithx, stockid, brands } = v;
        const data = {};
        if (debithx.length == 0) {
          const credithx = await promisifyQuery(`SELECT * FROM generalstorecredithx
          AS chx INNER JOIN stocksbrands AS sb ON sb.brandid = chx.brandid WHERE chx.stockid = ${stockid} AND chx.brandid IN (${brands.join(",")})`);
          data.stockid = stockid;
          data.debitable = credithx;
        }
        if (debithx.length > 0) {
          let debitable = await inventory.isDebitable(stockid, brands);
          const debitableBrands = debitable.map((x, y) => x?.brandid);
          const creditBrands = [];

          for (let i = 0; i < brands.length; i++) {
            if (!debitableBrands.includes(brands[i])) creditBrands.push(brands[i]);
          }

          let unCapturedDebitable = await promisifyQuery(`SELECT * FROM generalstorecredithx
          AS chx INNER JOIN stocksbrands AS sb ON sb.brandid = chx.brandid WHERE chx.stockid = ${stockid} AND chx.brandid IN (${creditBrands.join(",")})`);
          data.stockid = stockid;
          data.debitable = [...debitable,...unCapturedDebitable];
          
        }
        
        data.debitable = data.debitable.map((item, index) => {
          if (!item?.storeQty) {
            const { productordersid, stockid, credit, brandid,batchnumber,brand} = item;
            return { storeQty: credit, productordersid, stockid, brandid, batchnumber, brand };
          }
          return item;
        })
        return data
      })
      products = (await outPromise(products)).filter( (u,v) => u.debitable.length > 0)
    }
    response.send(products)
}



const consumeDepartmentStock = async function (request, response) {
  const { employeeid, stockid, departmentid, consumeqty, brand, batchnumber,brandid } = request.body;

  // get stockitem
  const retrieveQuery = `SELECT * FROM departmentsmainsupply WHERE stockid = ? AND departmentid = ? AND brand = ? AND batchnumber = ?`;

  const retrieveValues = [stockid, parseInt(departmentid), brandid, batchnumber];

  const stockdata = await promisifyQuery(retrieveQuery, retrieveValues);

  if (stockdata.length > 0) {
    const prev = parseInt(stockdata[0]['quantity']);
    const conqty = parseInt(consumeqty);
    if (prev >= conqty) {
      const balance = prev - conqty;
      const updateQuery = `UPDATE departmentsmainsupply SET quantity = ? 
      WHERE departmentid  = ? AND batchnumber = ? AND stockid = ?  AND brand = ?`;

      const updateValues = [balance, departmentid, batchnumber, stockid, brandid];
      const updateConsumption = await promisifyQuery(updateQuery, updateValues);

      if (updateConsumption && updateConsumption.affectedRows == 1) {
        const hxQuery = `INSERT INTO departmentconsumptionhx (department,stockid,batchnumber,brand,debit,employeeid) VALUES (?,?,?,?,?,?)`;

        const hxValues = [departmentid, stockid, batchnumber, brandid, conqty,employeeid];

        let hxResult = await promisifyQuery(hxQuery, hxValues);

        if (hxResult?.affectedRows > 0) {
          response.send({ message: 'stock successfully consumed', statusCode: 200, status: 'success' })
        }
      }
    } else {
      customError(`qty to be consumed must be less than qty available`, 404, response);
    }
  } else {
    customError('Not found ', 404, response)
  }
}

// ---------------------------

module.exports = {
  newdepartmentRequisition,
  getDepartmentsRequisitions,
  specificDepartmentRequisition,
  getDeptStocks,
  deleteDeptStocks,
  patchRequisition,
  updateRequisitionAfterReceivedDept,
  consumeDepartmentStock,
  generalStoreLotNo
};



