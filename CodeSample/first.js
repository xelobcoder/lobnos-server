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
        const updateQtyQuery = `UPDATE generalstocks SET quantity = ${qtyInDbAfterSubstraction} WHERE stockid = ${stockid}`;

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
      const instock = `SELECT quantity FROM generalstocks WHERE stockid = ${stockid}`;

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

      const stockInfo = `SELECT * FROM generalstocks WHERE stockid = ${stockid}`;

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

    // we check the quantity in the new stock table
  };


 connection.beginTransaction(async function (err) {
      if (err) { logger.error(err); }
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



// ----------------------------------------
    // this function checks if the stock is already in the department stock table
  //   const isDeptHaveStock = async function (stockid, departmentid) {
  //     // returna a promise

  //     const query = `SELECT * FROM departmentstocks WHERE stockid = ${stockid} AND
  //      deptid = ${departmentid}`;
  //     // we return a promise
  //     const isStock = new Promise((resolve, reject) => {
  //       connection.query(query, function (err, result) {
  //         if (err) {
  //           reject(err);
  //         }
  //         if (result) {
  //           resolve(result);
  //         }
  //       });
  //     }
  //     );

  //     return isStock;
  //   }


  //   //  this function adds new stock to the department stock table
  //   const addingNewDeptStock = async function (stockid, qtyR, departmentid, comsumptionunit) {
  //     // return a promise
  //     const addNewStock = `INSERT INTO departmentstocks (stockid, deptid, quantityAvailable, comsumptionunit)
  //       VALUES (${stockid}, ${departmentid}, ${qtyR}, '${comsumptionunit}')`;

  //     const newStock = new Promise((resolve, reject) => {
  //       connection.query(addNewStock, function (err, result) {
  //         if (err) {
  //           reject(err);
  //         }
  //         if (result) {
  //           resolve(result.affectedRows);
  //         }
  //       });
  //     }
  //     );

  //     return newStock;
  //   }


  //   // this function reduce qty in the new stock table

  //   const reducingQtyInNewStock = async function (stockid, qtyR) {
  //     // return a promise
  //     // we want decrement the quantity in the new stock table by the quantity received
  //     // we get the qty Recieved from db,substract qry received from it and update the db

  //     const getQty = `SELECT quantity FROM generalstocks WHERE stockid = ${stockid}`;
  //     // get the data from db
  //     const qty = new Promise((resolve, reject) => {
  //       connection.query(getQty, function (err, result) {
  //         if (err) {
  //           reject(err);
  //         }
  //         if (result) {
  //           resolve(result);
  //         }
  //       });
  //     });

  //     const resultSet = await qty;



  //     if (resultSet.length > 0) {
  //       const qtyInDb = resultSet[0].quantity;
  //       // we substract the qty received from the qty in db
  //       const qtyInDbAfterSubstraction = qtyInDb - qtyR;
  //       // we update the db
  //       const updateQtyQuery = `UPDATE generalstocks SET quantity = ${qtyInDbAfterSubstraction} WHERE stockid = ${stockid}`;

  //       const updatedQty = new Promise((resolve, reject) => {
  //         connection.query(updateQtyQuery, function (err, result) {
  //           if (err) {
  //             reject(err);
  //           }
  //           if (result) {
  //             resolve(result.affectedRows);
  //           }
  //         });
  //       }
  //       );
  //       return updatedQty;
  //     }

  //   }


  //   // this function checks the quantity in the new stock table

  //   const checkingQtyInNewStock = async function (stockid) {
  //     // return a promise
  //     const instock = `SELECT quantity FROM generalstocks WHERE stockid = ?`;
  //     return promisifyQuery(instock, [stockid]);
  //   }


  //   //  this function updates the quantity of the stock in the department stock table
  //   const updatingDeptStock = async function (departmentid, stockid, qty) {
  //     // return a promise
  //     const previousQty = promisifyQuery(`SELECT * FROM departmentstocks WHERE deptid = ? AND stockid = ?`, [departmentid, stockid])
  //     const previous = await previousQty()
  //     const qtyAvailable = previous[0]?.quantityAvailable;
  //     // adding quantity receieved to previous stock level
  //     const current = parseInt(qtyAvailable) + qty;
  //     const updatedeptmentStocks = `UPDATE departmentstocks
  //      SET quantityAvailable = ?,
  //       dateupdated = NOW()
  //     WHERE deptid = ? and stockid = ?`

  //     const result = await promisifyQuery(updatedeptmentStocks, [current, qty, stockid]);
  //     return result?.affectedRows;
  //   }



  //   // this function gets the stock information from the new stock table
  //   const getStockInformation = async function (stockid) {
  //     const stockInfo = await promisifyQuery(`SELECT * FROM generalstocks WHERE stockid = ?`, [stockid])
  //     if (stockInfo.length > 0 && stockInfo) {
  //       return {
  //         stockid: stockInfo[0].stockid,
  //         consumptionunit: stockInfo[0].consumptionunit,
  //         name: stockInfo[0].name,
  //       }
  //     } else {
  //       return null;
  //     }
  //   }


  //   const rollback = function (err, message) {
  //     connection.rollback(function () {
  //       logger.error(err)
  //       return response.status(400).json({
  //         status: 'error',
  //         statusCode: 400,
  //         message
  //       })
  //     }
  //     );
  //   }


  //   const commit = function () {
  //     connection.commit(function (err) {
  //       if (err) {
  //         return connection.rollback(function () {
  //           logger.error(err);
  //         });
  //       }
  //       else {
  //         return response.status(200).json({
  //           status: 'success',
  //           statusCode: 200,
  //           message: 'The stock was added to the department stock table'
  //         })
  //       }
  //     });
  //   }

  //   // const { quantityReceived, departmentReceived, id, departmentid } = request.body;/

  //   // update the quantity received and the department received
  //   // check the quantity in the new stock table, 
  //   // if the quantity is less than the quantity received, return an error
  //   //  if the quantity is more than the quantity received,
  //   // reduce the quantity in the news stock table by the quantity received
  //   // check if the stock is already in the department stock table
  //   // if it is, update the quantity
  //   // if it is not, add the stock to the department stock table

  //   // NB:this would be rewritten using transactions to ensure data integrity and ACID compliance.

  //   // we check the quantity in the new stock table
  //   const checkQty = await checkingQtyInNewStock(stockid);
  //   const instockQty = checkQty[0].quantity;
  //   //       // if quantity is less than the quantity received, return an error
  //   if (instockQty < quantityReceived) {
  //     return response.status(400).json({
  //       status: 'error',
  //       statusCode: 400,
  //       message: 'The quantity received is more than the quantity in the new stock table'
  //     })
  //   } else {
  //     connection.beginTransaction();
  //     try {
  //       let isUpdated = await updatingQtyReceived(id, quantityReceived, departmentReceived);

  //       if (isUpdated === 1) {
  //         const reduceGeneralStock = await reducingQtyInNewStock(stockid, quantityReceived);
  //         if (reduceGeneralStock && reduceGeneralStock === 1) {
  //           const doDepartmentHaveStock = await isDeptHaveStock(stockid, departmentid);
  //           if (doDepartmentHaveStock && doDepartmentHaveStock.length == 0) {
  //             const added = await addingNewDeptStock(stockid, departmentReceived, departmentid, consumptionunit);
  //             if (added === 1) commit();
  //           } else {
  //             let updatedresult = await updatingDeptStock(departmentid, stockid, quantityReceived);
  //             if (updatedresult === 1) commit();
  //           }
  //         }
  //       }
  //     } catch (err) {
  //       rollback(err, 'Error occured duirng the transaction')
  //     }
  //   }
  // };
