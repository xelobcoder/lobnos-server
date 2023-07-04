const { PrismaClient } = require("@prisma/client");
const { query } = require("express");
const connection = require("../db");
const prisma = new PrismaClient();
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
  // limit by 50 and in desc order
  const departmentsRequisitions = async () => {
    let dept = prisma.departmentrequisitionhx.findMany({
      take: 20,
      orderBy: {
        id: "desc",
      },
    });
    return dept;
  };

  departmentsRequisitions()
    .then((data) => {
      response.send({
        statusCode: 200,
        status: "success",
        message: "Departments requisitions fetched successfully",
        data,
      });
    })
    .catch((error) => {
      console.log(error);
      response.send({
        statusCode: 500,
        status: "error",
        message: "Departments requisitions not fetched",
        error,
      });
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
        INNER JOIN newstock AS ns ON ns.stockid = drh.stockid
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
        INNER JOIN newstock AS ns ON ns.stockid = drh.stockid
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
            INNER JOIN newstock AS ns ON ns.stockid = drh.stockid
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
          INNER JOIN newstock AS ns ON ns.stockid = drh.stockid
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
  const { quantityReceived, departmentReceived, id, status } = request.body;
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
            resolve(result);
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
            resolve(result);
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

      const getQty = `SELECT quantity FROM newstock WHERE stockid = ${stockid}`;
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
        const qtyInDb = qty[0].quantity;
        // we substract the qty received from the qty in db
        const qtyInDbAfterSubstraction = qtyInDb - qtyR;
        // we update the db
        const updateQty = `UPDATE newstock SET quantity = ${qtyInDbAfterSubstraction} WHERE stockid = ${stockid}`;
        const updatedQty = new Promise((resolve, reject) => {
          connection.query(updateQty, function (err, result) {
            if (err) {
              reject(err);
            }
            if (result) {
              resolve(result);
            }
          });
        }
        );
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
    const updatingDeptStock = async function (id, qty) {
      // return a promise

      const updatedeptmentStocks =`UPDATE departmentstocks
       SET quantityAvailable = ${qty},
        dateupdated = '${new Date()}'
      WHERE id = ${id}`
     
    //  exceute the query and return a promise
      const updatedQty = new Promise((resolve, reject) => {
        connection.query(updatedeptmentStocks, function (err, result) {
          if (err) {
            reject(err);
          }
          if (result) {
            resolve(result);
          }
        });
      });

      return updatedQty;
    }



    // this function gets the stock information from the new stock table
    const getStockInformation = async function (stockid) {
      // return a promise
      const stockInfo = await prisma.newstock.findFirst({
        where: {
          stockid: stockid,
        },
      });

      return {
        stockid: stockInfo.stockid,
        comsumptionunit: stockInfo.consumptionunit,
        name: stockInfo.name,
      };
    }

    const { quantityReceived, departmentReceived, id, departmentid } = request.body;

    // update the quantity received and the department received
    // check the quantity in the new stock table, 
    // if the quantity is less than the quantity received, return an error
    //  if the quantity is more than the quantity received,
    // reduce the quantity in the news stock table by the quantity received
    // check if the stock is already in the department stock table
    // if it is, update the quantity
    // if it is not, add the stock to the department stock table

    // NB:this would be rewritten using transactions to e=nsure data integrity and ACID compliance.

    updatingQtyReceived(id, quantityReceived, departmentReceived)
      .then((result) => {
        checkingQtyInNewStock(result.stockid)
          .then((result) => {
            const qty = result.quantity;
            const stockid = result.stockid;
            if (qty < quantityReceived) {
              response.send({
                status: "error",
                message: "quantity received is more than the quantity in the store..Kindly contact the store manager",
              });
            } else if (qty === 0) {
              response.send({
                status: "error",
                message: "out of stock",
              });
            }
            else {
              reducingQtyInNewStock(result.stockid, quantityReceived)
                .then((result) => {
                  isDeptHaveStock(result.stockid, departmentid)
                    .then((result) => {
                      if (result === null) {
                        getStockInformation(stockid)
                          .then((result) => {
                            addingNewDeptStock(
                              result.stockid,
                              quantityReceived,
                              departmentid,
                              result.comsumptionunit
                            )
                              .then((result) => {
                                response.send({
                                  status: "success",
                                  message:
                                    "stock added to department stock successfully",
                                  result,
                                  statusCode: 200,
                                });
                              })
                              .catch((err) => {
                                console.log(err);
                              });
                          })
                          .catch((err) => {
                            console.log(err);
                          });
                      } else {
                        const id = result.id;
                        const qty = result.quantityAvailable;
                        const newQty = qty + quantityReceived;
                        updatingDeptStock(id, newQty)
                          .then((result) => {
                            response.send({
                              status: "success",
                              message: "stock updated successfully",
                              result,
                              statusCode: 200,
                            });
                          })
                          .catch((err) => {
                            console.log(err);
                          });
                      }
                    })
                    .catch((err) => {
                      console.log(err);
                    });
                })
                .catch((err) => {
                  console.log(err);
                });
            }
          }).catch((err) => { console.log(err) });
      }).catch((err) => { console.log(err) });
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
