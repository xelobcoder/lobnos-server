const { query } = require("express");
const connection = require("../db");
const { get } = require("../controllers/results");
const logger = require("../../logger");

const uuidv4 = require("uuid").v4;

const newdepartmentRequisition = (request, response) => {
  const { stockid, departmentid, quantity, comsumptionunit } = request.body;

  const requisitionid = uuidv4();

  const isNotEmptyFields = Object.values(request.body).filter((field) => {
    return field === "" || field === null;
  });

  if (isNotEmptyFields.length > 0) {
    response.send({
      statusCode: 400,
      status: "error",
      message: "All fields are required",
    });
  } else {
    // check if the stockid is  available in department requisition table hx  and the date is today
    // if  send a message that the stock has already been requisitioned
    // else add the stock to the department requisition table
    const checkIfStockIsAlreadyRequisitioned = async () => {
      // select all requisition which has not been approved or resolved
      const query = `SELECT * FROM departmentrequisitionhx
       WHERE stockid = ? AND departmentid = ? AND quantity_approved IS NULL`;

      const check = new Promise((resolve, reject) => {
        connection.query(query, [stockid, departmentid], function (err, result) {
          if (err) {
            reject(err);
          }
          if (result) {
            resolve(result);
          }
        });
      });
      // return a promise 
      return check;
    };

    checkIfStockIsAlreadyRequisitioned().then((data) => {
      if (data.length > 0) {
        response.send({
          statusCode: 200,
          status: "success",
          message: "Stock has already been requisitioned",
        });
      } else {
        const newdepartmentRequisition = async () => {
          // we create a new requisition since the stock has not been requisitioned

          // sql query
          const sql_query = `INSERT INTO departmentrequisitionhx
          (stockid, departmentid, quantity_requested, comsumptionunit, requisitionid)
          VALUES (?,?,?,?,?)`;

          const newRequisition = new Promise((resolve, reject) => {
            connection.query(
              sql_query,
              [stockid, departmentid, quantity, comsumptionunit, requisitionid],
              function (err, result) {
                if (err) {
                  reject(err);
                }
                if (result) {
                  resolve(result);
                }
              }
            );
          })
          // return a promise
          return newRequisition;
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
    });
  }
};

const getDepartmentsRequisitions = async function (request, response) {
  const query = `
    SELECT *
    FROM departmentrequisitionhx
    ORDER BY id DESC
    LIMIT 20;
  `;

  connection.query(query, (error, results) => {
    if (error) {
      console.error('Error fetching department requisitions:', error);
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

const specificDepartmentRequisition = async function (request, response, include = false) {
  const { id } = request.query;
  // join department requisition table with  name of department  table and name of newstock table
  const mysql_query = function () {
    const { id, type } = request.query;

    if (type === "pending") {
      return `SELECT  drh.id,
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
         FROM departmentrequisitionhx AS drh
        INNER JOIN departments AS d ON d.id = drh.departmentid
        INNER JOIN generalstock AS ns ON ns.stockid = drh.stockid
        WHERE drh.departmentid = ${id} AND quantity_approved IS NULL `
    }

    if (type === "approved") {
      return `SELECT  drh.id,
        drh.departmentid, 
        drh.stockid, 
        drh.quantity_requested,
        drh.quantity_approved,
        drh.quantityReceived,
        drh.status,
         drh.date,
         drh.requisitionid,
         drh.comsumptionunit,
         d.department,ns.stockid,
         ns.name,
         ns.quantity
         FROM departmentrequisitionhx AS drh
        INNER JOIN departments AS d ON d.id = drh.departmentid
        INNER JOIN generalstock AS ns ON ns.stockid = drh.stockid
        WHERE drh.departmentid = ${id} AND quantity_approved IS NOT NULL AND status = 'approved'`
    }

    if (type === "rejected") {
      return `SELECT  drh.id,
            drh.departmentid,
            drh.stockid,
            drh.quantity_requested,
            drh.quantity_approved,
            drh.quantityReceived,
            drh.status,
            drh.date,
            drh.requisitionid,
            drh.comsumptionunit,
            d.department,ns.stockid,
            ns.name,
            ns.quantity
            FROM departmentrequisitionhx AS drh
            INNER JOIN departments AS d ON d.id = drh.departmentid
            INNER JOIN generalstock AS ns ON ns.stockid = drh.stockid
            WHERE drh.departmentid = ${id} AND quantity_approved IS NOT NULL AND status = 'rejected'`
    }

    if (type === "received") {
      return `SELECT  drh.id,
          drh.departmentid,
          drh.stockid,
          drh.quantity_requested,
          drh.quantity_approved,
          drh.quantityReceived,
          drh.status,
          drh.date,
          drh.requisitionid,
          drh.comsumptionunit,
          d.department,ns.stockid,
          ns.name,
          ns.quantity
          FROM departmentrequisitionhx AS drh
          INNER JOIN departments AS d ON d.id = drh.departmentid
          INNER JOIN generalstock AS ns ON ns.stockid = drh.stockid
          WHERE drh.departmentid = ${id} AND quantity_approved IS NOT NULL AND status = 'received'`
    }


  }

  if (id === undefined || id === null) {
    response.send({
      status: "error",
      message: "department requisition id not included",
    });
  } else {
    connection.query(mysql_query(), function (err, result) {
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
    });
  }
};


const patchRequisition = async function (request, response, requi_id) {
  // update the department requisition table with the quantity approved and the status=approved
  const { quantity_approved, store_supplied } = request.body;
  const mysql_query = `UPDATE departmentrequisitionhx
   SET quantity_approved = ${quantity_approved},
   store_supplied = ${store_supplied},
   status = 'approved' WHERE id = '${parseInt(requi_id)}'`;

  if (requi_id === undefined || requi_id === null ||
    quantity_approved === undefined || quantity_approved === null || store_supplied === undefined || store_supplied === null) {
    response.send({
      status: "error",
      message: "required fields not included",
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
          message: "success",
          data: result,
          statusCode: 200,
        });
      }
    })
  }
}

const getDeptStocks = async function (request, response, id) {
  const mysql_query = `SELECT * FROM newstock 
  AS np INNER JOIN departmentstocks AS
  ds ON np.stockid = ds.stockid INNER 
  JOIN departments AS d ON d.id = ds.deptid 
  WHERE ds.deptid = ${id} `;

  if (id === undefined || id === null) {
    response.send({
      status: "error",
      message: "department id not included",
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
  const { quantityReceived, departmentReceived, id, status, stockid, consumptionunit, departmentid } = request.body;
  if (!quantityReceived || !departmentReceived || !id) {
    response.send({
      status: "error",
      message: "required fields not included",
    });
  } else {
    // this updates `quantityReceived` and `departmentReceived` fields
    const updatingQtyReceived = async function (id, qtyR, dptR) {
      // using prisma to update the quantity received and the department received and retun a promise
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



    // this function checks if the stock is already in the department stock table
    const isDeptHaveStock = async function (stockid, departmentid) {
      // returna a promise

      const query = `SELECT * FROM departmentstocks WHERE stockid = ${stockid} AND
       deptid = ${departmentid}`;
      // we return a promise
      const isStock = new Promise((resolve, reject) => {
        connection.query(query, function (err, result) {
          if (err) {
            reject(err);
          }
          if (result) {
            resolve(result);
          }
        });
      }
      );

      return isStock;
    }


    //  this function adds new stock to the department stock table
    const addingNewDeptStock = async function (stockid, qtyR, departmentid, comsumptionunit) {
      // return a promise
      const addNewStock = `INSERT INTO departmentstocks (stockid, deptid, quantityAvailable, comsumptionunit)
        VALUES (${stockid}, ${departmentid}, ${qtyR}, '${comsumptionunit}')`;

      const newStock = new Promise((resolve, reject) => {
        connection.query(addNewStock, function (err, result) {
          if (err) {
            reject(err);
          }
          if (result) {
            resolve(result.affectedRows);
          }
        });
      }
      );

      return newStock;
    }


    // this function reduce qty in the new stock table

    const reducingQtyInNewStock = async function (stockid, qtyR) {
      // return a promise
      // we want decrement the quantity in the new stock table by the quantity received
      // we get the qty Recieved from db,substract qry received from it and update the db

      const getQty = `SELECT quantity FROM generalstocks WHERE stockid = ${stockid}`;
      // get the data from db
      const qty = new Promise((resolve, reject) => {
        connection.query(getQty, function (err, result) {
          if (err) {
            reject(err);
          }
          if (result) {
            resolve(result);
          }
        });
      });

      const resultSet = await qty;



      if (resultSet.length > 0) {
        const qtyInDb = resultSet[0].quantity;
        // we substract the qty received from the qty in db
        const qtyInDbAfterSubstraction = qtyInDb - qtyR;
        // we update the db
        const updateQtyQuery = `UPDATE newstock SET quantity = ${qtyInDbAfterSubstraction} WHERE stockid = ${stockid}`;

        const updatedQty = new Promise((resolve, reject) => {
          connection.query(updateQtyQuery, function (err, result) {
            if (err) {
              reject(err);
            }
            if (result) {
              resolve(result.affectedRows);
            }
          });
        }
        );
        return updatedQty;
      }

    }


    // this function checks the quantity in the new stock table

    const checkingQtyInNewStock = async function (stockid) {
      // return a promise
      const instock = `SELECT quantity FROM newstock WHERE stockid = ${stockid}`;

      const qty = new Promise((resolve, reject) => {
        connection.query(instock, function (err, result) {
          if (err) {
            reject(err);
          }
          if (result) {
            resolve(result);
          }
        });
      });

      return qty;
    }


    //  this function updates the quantity of the stock in the department stock table
    const updatingDeptStock = async function (departmentid, stockid, qty) {
      // return a promise

      const previousQty = function () {
        return new Promise((resolve, reject) => {
          connection.query(`SELECT * FROM departmentstocks WHERE deptid = ? AND stockid = ?`,
            [departmentid, stockid], function (err, result) {
              if (err) {
                reject(err)
              }
              else {
                resolve(result)
              }
            })
        })

      }


      const previous = await previousQty()
      const qtyAvailable = previous[0]?.quantityAvailable;

      // adding quantity receieved to previous stock level
      const current = parseInt(qtyAvailable) + qty;

      const updatedeptmentStocks = `UPDATE departmentstocks
       SET quantityAvailable = ${current},
        dateupdated = NOW()
      WHERE deptid = ${departmentid} and stockid = ${stockid}`

      //  exceute the query and return a promise
      const updatedQty = new Promise((resolve, reject) => {
        connection.query(updatedeptmentStocks, function (err, result) {
          if (err) {
            reject(err);
          }
          if (result) {
            resolve(result.affectedRows);
          }
        });
      });

      return updatedQty;
    }



    // this function gets the stock information from the new stock table
    const getStockInformation = async function (stockid) {
      // return a promise

      const stockInfo = `SELECT * FROM newstock WHERE stockid = ${stockid}`;

      const stock = new Promise((resolve, reject) => {
        connection.query(stockInfo, function (err, result) {
          if (err) {
            reject(err);
          }
          if (result) {
            resolve(result);
          }
        });
      });


      const getStockInformation = await stock;

      return {
        stockid: getStockInformation[0].stockid,
        consumptionunit: getStockInformation[0].consumptionunit,
        name: getStockInformation[0].name,
      }

    }

    // const { quantityReceived, departmentReceived, id, departmentid } = request.body;/

    // update the quantity received and the department received
    // check the quantity in the new stock table, 
    // if the quantity is less than the quantity received, return an error
    //  if the quantity is more than the quantity received,
    // reduce the quantity in the news stock table by the quantity received
    // check if the stock is already in the department stock table
    // if it is, update the quantity
    // if it is not, add the stock to the department stock table

    // NB:this would be rewritten using transactions to ensure data integrity and ACID compliance.
    connection.beginTransaction(async function (err) {
      if (err) {logger.error(err); }
      // we check the quantity in the new stock table
      const checkQty = await checkingQtyInNewStock(stockid);
      const instockQty = checkQty[0].quantity;
      // if quantity is less than the quantity received, return an error

      if (instockQty < quantityReceived) {
        return response.status(400).json({
          status: 'error',
          statusCode: 400,
          message: 'The quantity received is more than the quantity in the new stock table'
        })
      } else {
        // 1. update requisition hx table with the quantity received and the department received
        const updateRequisition = await updatingQtyReceived(id, quantityReceived, departmentReceived);
        // if affected rows is greater than 0, continue else return an error
        if (updateRequisition > 0) {
          // 2. update the quantity in the new stock table
          const reduceGeneralSoreQty = await reducingQtyInNewStock(stockid, quantityReceived);
          // if affected rows is greater than 0, continue else return an error
          if (reduceGeneralSoreQty > 0) {
            // 3. check if the stock is already in the department stock table
            const isStockInDeptStock = await isDeptHaveStock(stockid, departmentid);
            // if length is greater than 0, update the quantity else add the stock to the department stock table
            console.log(isStockInDeptStock.length);
            if (isStockInDeptStock.length == 0) {
              // add the stock to the department stock table
              const pushNewStock = await addingNewDeptStock(stockid, quantityReceived, departmentid, consumptionunit);
              // if affected rows is greater than 0, continue else return an error
              if (pushNewStock > 0) {
                // commit the transaction
                connection.commit(function (err) {
                  if (err) {
                    return connection.rollback(function () {
                     logger.error(err);
                    });
                  }
                  else {
                    return response.status(200).json({
                      status: 'success',
                      statusCode: 200,
                      message: 'The stock was added to the department stock table'
                    })
                  }
                });
              } else {
                // rollback the transaction
                connection.rollback(function () {
                  return response.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: 'The stock was not added to the department stock table'
                  })
                }
                );
              }
            } else {
              // update the quantity in the department stock table
              const updateDeptStock = await updatingDeptStock(departmentid, stockid, quantityReceived);
              // if affected rows is greater than 0, continue else return an error
              if (updateDeptStock > 0) {
                // commit the transaction
                connection.commit(function (err) {
                  if (err) {
                    return connection.rollback(function () {
                     logger.error(err);
                    });
                  }
                  else {
                    return response.status(200).json({
                      status: 'success',
                      statusCode: 200,
                      message: 'The quantity was updated in the department stock table'
                    })
                  }
                });
              } else {
                // rollback the transaction
                connection.rollback(function () {
                  return response.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: 'The quantity was not updated in the department stock table'
                  })
                }
                );
              }
            }
          } else {
            // rollback the transaction
            connection.rollback(function () {
              return response.status(400).json({
                status: 'error',
                statusCode: 400,
                message: 'The quantity was not reduced in the new stock table'
              })
            });
          }
        } else {
          return response.status(400).json({
            status: 'error',
            statusCode: 400,
            message: 'The requisition was not updated'
          })
        }
      }
    })
  };



};

// ---------------------------

module.exports = {
  newdepartmentRequisition,
  getDepartmentsRequisitions,
  specificDepartmentRequisition,
  getDeptStocks,
  deleteDeptStocks,
  patchRequisition,
  updateRequisitionAfterReceivedDept,
};
