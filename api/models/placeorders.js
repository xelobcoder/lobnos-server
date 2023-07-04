const connection = require('../db');


const placeOrder = function (request, response) {
  const {
    quantity,
    stockid,
    name,
    tax,
    suppliername,
    supplierid,
    purchaseunit,
  } = request.body;
  // check if order exist and items are recieved 
  // if not recieved then update the order, then we notify the front end of order status
  // if recieved then we notify the front end of order status
  // if not available , insert into the database 
  const addNewOrder = (request, response) => {

    connection.query(
      `INSERT INTO orders (quantity, stockid, name, tax, suppliername, supplierid, purchaseunit) VALUES (?,?,?,?,?,?,?)`,
      [quantity, stockid, name, tax, suppliername, supplierid, purchaseunit],
      function (err, result) {
        if (err) {
          response.send({
            status: 'error',
            err,
          });
        }
        if (result) {
          response.send({
            status: 'success',
            message: 'order placed successfully',
            statusCode: 200,
          });
        }
      }
    );
  }

  const checkOrderExist = (stockid, supplierid) => {
    // select where stockid = stockid , received = false and supplierid = supplierid
    const query = `SELECT * FROM orders WHERE stockid = ? AND  received = ? AND supplierid = ?`;
    connection.query(query,
      [stockid, 'FALSE', supplierid],
      function (err, result) {

        if (err) {
          response.send({
            status: 'error',
            err,
          });
        }
        console.log(result)
        if (result) {
          const checkedLength = result.length;
          if (checkedLength === 0) {
            addNewOrder(request, response);
          }
          else {
            response.send({
              status: 'success',
              message: 'order already exist',
              info: `order already exist and is not yet recieved.kindly check the order ${result[0]['productordersid']}`,
              statusCode: 200,
            });
          }
        }
      })
  }


  checkOrderExist(stockid, supplierid);
}


const getOrders = async function (request, response) {
  const query = `SELECT * FROM orders WHERE received = 'FALSE' ORDER BY productordersid DESC LIMIT 50`;
  // execute the query
  connection.query(query, function (err, result) {
    if (err) {
      response.send({
        status: 'error',
        err,
      })
    }
    if (result) {
      response.send({
        status: 'success',
        result,
      })
    }
  })
}




const deleteAspecificOrder = function (orderid, response) {
  // creat a query 
  const query = `DELETE FROM orders WHERE productordersid = ?`;
  // execute the query
  connection.query
    (
      query,
      [orderid],
      function (err, result) {
        if (err) {
          console.log(err)
          response.send({
            status: 'error',
            err,
          })
        }
        if (result) {
          response.send({
            status: 'success',
            message: 'order deleted successfully',
            statusCode: 200,
          })
        }
      }
    )
}

const updateStock = async function (stockid, planned, request, response) {
  return new Promise((resolve, reject) => {
    // get the current stock quantity
    const query = `SELECT * FROM newstock WHERE stockid = ?`;
    connection.query(query, [stockid], function (err, result) {
      if (err) {
        reject(err)
      }
      if (result) {
        const { stockid, quantity } = result[0];
        const updatedQuantity = parseInt(quantity) + parseInt(planned);
        const query = `UPDATE newstock SET quantity = ? WHERE stockid = ?`;
        connection.query(query, [updatedQuantity, stockid], function (err, result) {
          if (err) {
            reject(err)
          }
          if (result) {
            resolve(result)
          }
        })
      }
    })
  })
}



const pushtodb = function (data) {
  const query = `UPDATE orders SET received = ?, quantityreceived = ?, receiveddate = ?, status = ?, expirydate = ?, batchnumber = ?, balance = ?, price = ?, tax = ?, totalamount = ? WHERE productordersid = ?`;

  return new Promise((resolve, reject) => {
    connection.query(
      query,
      data,
      function (err, result) {
        if (err) {
          reject(err)
        }
        else {
          resolve(result)
        }
      }
    );
  })
}


const addToStockTransactions = async function (data) {
  if (Array.isArray(data) && data.length > 0) {
    //  data in the arranged in this format i.e stockid,quantity,batchno,purchaseunit,supplierid
    // insert into stocktransactions
    const query = `INSERT INTO stocktransactions (stockid,quantity,batchno,purchaseunit,supplierid,added_on)
     VALUE (?, ?, ?, ?, ?, NOW())`;
    connection.query(query, data, function (err, result) {
      if (err) {
        throw err;
      }
      if (result) {
        console.log('stock transaction added successfully')
      }
    })
  }
}

const purchaseOrdersToStock = function (request, response) {
  let targetRef = request.body.length;
  let updatedQuantity = 0;
  let errRows = 0;
  while (updatedQuantity < targetRef) {
    let errlog = [];
    const datasource = request.body;
    // using map to get the items in the array
    const requiredDataSource = datasource.map((item, index) => {
      const { productordersid, received, receivedquantity, receiveddate, status, expirydate, batchnumber, balance, price, tax, totalamount } = item;
      return [received, receivedquantity, receiveddate, status, expirydate, batchnumber, balance, price, tax, totalamount, productordersid]
    })
    const { stockid, quantity, supplierid, purchaseunit, batchnumber } = datasource[updatedQuantity];
    pushtodb(requiredDataSource[updatedQuantity])
      .then((result) => {
        let successRow = 0;
        let errRows = 0;
        updateStock(stockid, quantity, request, response)
          .then((result) => {
            successRow++;
            // add to stock transactions
            addToStockTransactions([stockid, quantity, batchnumber, purchaseunit, supplierid])
            return;
          })
          .catch((err) => {
            errRows++;
            console.log(err)
          })
      })
      .catch((err) => {
        errRows++;
        console.log(err)
        errlog.push(err);
      })
    updatedQuantity++;
  }

  if (updatedQuantity === targetRef) {
    response.send({
      status: 'success',
      message: 'order recieved successfully',
      statusCode: 200,
    })
  }
  else {
    response.send({
      status: 'error',
      message: 'error occured',
      statusCode: 200,
    })
  }

}



module.exports = { placeOrder, getOrders, deleteAspecificOrder, purchaseOrdersToStock };