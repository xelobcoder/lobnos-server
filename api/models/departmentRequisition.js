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
      const check = await prisma.departmentrequisitionhx.findMany({
        where: {
          stockid: stockid,
          departmentid: departmentid,
          quantity_approved: null,
        },
      });
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
          const creation = await prisma.departmentrequisitionhx.create({
            data: {
              stockid,
              departmentid,
              quantity_requested: quantity,
              comsumptionunit,
              requisitionid,
            },
          });
          return creation;
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
            console.log(error);
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
    const queris = Object.keys(request.query);
    if (queris.length === 1 && queris.includes('id')) {
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
      WHERE drh.departmentid = ${id}`
    }
    else {
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
  const { quantityReceived, departmentReceived, id } = request.body;
  if (!quantityReceived || !departmentReceived || !id) {
    response.send({
      status: "error",
      message: "required fields not included",
    });
  } else {

    console.log(request.body);
    // this updates `quantityReceived` and `departmentReceived` fields
    const updatingQtyReceived = async function (id, qtyR, dptR) {
      // using prisma to update the quantity received and the department received and retun a promise
      const update = await prisma.departmentrequisitionhx.update({
        where: {
          id: parseInt(id),
        },
        data: {
          quantityReceived: qtyR,
          departmentReceived: dptR,
        },
      });

      return update;
    }


    // this function checks if the stock is already in the department stock table
    const isDeptHaveStock = async function (stockid, departmentid) {
      // returna a promise
      const deptStock = await prisma.departmentstocks.findFirst({
        where: {
          stockid: stockid,
          deptid: departmentid,
        },
      });

      return deptStock;
    }


    //  this function adds new stock to the department stock table
    const addingNewDeptStock = async function (stockid, qtyR, departmentid, comsumptionunit) {
      // return a promise
      const newDeptStock = await prisma.departmentstocks.create({
        data: {
          stockid: stockid,
          deptid: departmentid,
          quantityAvailable: qtyR,
          comsumptionunit: comsumptionunit,
        },
      });

      return newDeptStock;
    }


    // this function reduce qty in the new stock table

    const reducingQtyInNewStock = async function (stockid, qtyR) {
      // return a promise
      const newStock = await prisma.newstock.update({
        where: {
          stockid: stockid,
        },
        data: {
          quantity: {
            decrement: qtyR,
          },
        },
      });

      return newStock;
    }


    // this function checks the quantity in the new stock table

    const checkingQtyInNewStock = async function (stockid) {
      // return a promise
      const newStock = await prisma.newstock.findFirst({
        where: {
          stockid: stockid,
        },
      });

      return newStock;
    }


    //  this function updates the quantity of the stock in the department stock table
    const updatingDeptStock = async function (id, qty) {
      // return a promise
      const deptStock = await prisma.departmentstocks.update({
        where: {
          id: id,
        },
        data: {
          quantityAvailable: qty,
          dateupdated: new Date(),
        },
      });

      return deptStock;
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
