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



const updateRequisitionAfterReceivedDept = async function (request, response) {
  const { quantityReceived, departmentReceived, id } = request.body;
  if (!quantityReceived || !departmentReceived || !id) {
    response.send({
      status: "error",
      message: "required fields not included",
    });
  }
  else {
    // using mysql query to update the department requisition table


    const reduceMainStock = function (stockid, quantity) {
      //  create function to reduce stock from the newstock table
      // get the current quantity of the stock
      const mysql_query = `SELECT quantity FROM newstock WHERE stockid = ${stockid}`;
      connection.query(mysql_query, function (err, result) {
        if (err) {
          response.send({
            status: "error",
            message: err.message,
          });
        }
        if (result) {
          let currentQuantity = result[0].quantity;
          let newQuantity = parseInt(currentQuantity) - parseInt(quantity);
          const mysql_query = `UPDATE newstock SET quantity = ${newQuantity} WHERE stockid = ${stockid}`;
          connection.query(mysql_query, function (err, result) {
            if (err) {
              response.send({
                status: "error",
                message: err.message,
              });
            }
            if (result) {
              console.log("stock updated successfully");
            }
          }
          )
        }
      })
    }



    const addToDeptStock = function (stockid, quantityReceived, departmentid) {
      // check if stock exists in the department stock table
      const mysql_query = `SELECT * FROM departmentstocks WHERE stockid = ${stockid} AND deptid = ${departmentid}`;
      connection.query(mysql_query, function (err, result) {
        if (err) {
          response.send({
            status: "error",
            message: err.message,
            info: "error checking if stock exists in department stock table"
          });
        }

        if (result) {
          const xlen = result.length;
          if (xlen === 0) {
            // stock does not exist in the department stock table
            // insert stock into the department stock table
            const mysql_query = `INSERT INTO departmentstocks (stockid, deptid, quantityAvailable,consumption) VALUES (${stockid}, ${departmentid}, ${quantityReceived}, 'null)`;

            connection.query(mysql_query, function (err, result) {
              if (err) {
                response.send({
                  status: "error",
                  message: err.message,
                  info: "error inserting stock into department stock table"
                });
              }

              if (result) {
                console.log("stock inserted into department stock table");
              }

            })


          }

          else {
            // stock exists in the department stock table
            // update the quantity available in the department stock table
            let currentStockQty = result[0].quantityAvailable;
            //  update the stock level

          }
        }
      })
    }
    const mysql_query = `UPDATE departmentrequisitionhx
     SET quantityReceived = ${quantityReceived}, 
     departmentReceived = '${departmentReceived}',
     status = 'received'
      WHERE id = ${id}`;

    connection.query(mysql_query, function (err, result) {
      if (err) {
        response.send({
          status: "error",
          message: err.message,
        });
      }

      if (result) {
        const affectedRows = result.affectedRows;
        if (affectedRows === 0) {
          response.send({
            status: "error",
            message: "requisition not found",
          });
        }
        else {
          // select * from departmentrequisitionhx where id = ${id}
          const mysql_query = `SELECT * FROM departmentrequisitionhx WHERE id = ${id}`;
          connection.query(mysql_query, function (err, result) {
            if (err) {
              response.send({
                status: "error",
                message: err.message,
              });
            }

            if (result) {
              console.log(result)
              // create function to update the department stock table or add to department stock table
              //  create function to reduce stock from the newstock table
            }
          });
        }
      }
    })
  }
};



module.exports = {
  newdepartmentRequisition,
  getDepartmentsRequisitions,
  specificDepartmentRequisition,
  getDeptStocks,
  deleteDeptStocks,
  patchRequisition,
  updateRequisitionAfterReceivedDept,
};
