const { promisifyQuery, customError } = require('../../helper');
const logger = require('../../logger');
const connection = require('../db');


const placeOrder = async function (request, response) {
  let successCount = 0;
  let errorCount = 0;
  let Exit = [];
  // check if order exist and items are recieved 
  // if not recieved then update the order, then we notify the front end of order status
  // if recieved then we notify the front end of order status
  // if not available , insert into the database 
  const addNewOrder = async (orderTransactionid, item) => {
    const { quantity, stockid, name, suppliername, supplierid, purchaseunit } = item;
    let query = `INSERT INTO orders (quantity, stockid, name, suppliername, supplierid, purchaseunit,orderTransactionid)
       VALUES (?,?,?,?,?,?,?)`;
    let values = [
      quantity,
      stockid,
      name,
      suppliername,
      supplierid,
      purchaseunit,
      orderTransactionid,
    ];
    return promisifyQuery(query, values);
  }

  const checkOrderExist = async (item, transactionid) => {
    const { supplierid, stockid } = item;
    // select where stockid = stockid , received = false and supplierid = supplierid
    const query = `SELECT COUNT(*) AS count FROM orders WHERE stockid = ? AND  received = ? AND supplierid = ?`;
    const values = [stockid, "FALSE", supplierid];
    return promisifyQuery(query, values);
  }

  const { stock } = request.body;
  // create a unique id that runs for that product for this session
  const orderTransactionid = Date.now();
  // for length is greater than 0 zero, loop ,check if exist and added if none
  if (Array.isArray(stock) && stock.length > 0) {
    let counter = 0;
    stock.forEach(async (item, index) => {
      try {
        let present = await checkOrderExist(item, orderTransactionid);
        let count = present[0]?.count;
        if (present && count > 0) {
          Exit.push(item)
        } else {
          let added = await addNewOrder(orderTransactionid, item);
          let affectedRows = added?.affectedRows;
          if (affectedRows === 1) successCount++;
        };
      } catch (err) {
        logger.error(err);
        errorCount++;
      }
      counter++;
      if (counter === stock.length) {
        let responseString = ``;
        Exit.forEach((item, index) => {
          const { suppliername, name, stockid } = item;
          responseString += `${name} with stockid ${stockid} request to ${suppliername} was earlier on requested but remained unresolved,hence not added ,`;
        });
        response.send({
          statusCode: 200,
          status: "success",
          message: `${successCount} items successfully requested.${errorCount}  error occured. ${responseString}`,
        });
      }
    })
  }
}


const getOrders = async function (request, response) {
  const { orderTransactionid } = request.query;
  let query = `SELECT * FROM orders WHERE received = 'FALSE'`;
  if (orderTransactionid) {
    query += ` AND orderTransactionid = ?`
  }
  query += ` ORDER BY productordersid DESC LIMIT 50`
  // execute the query
  try {
    let result = await promisifyQuery(query, orderTransactionid)
    response.send({ result, status: 'success', statusCode: 200 })
  } catch (err) {
    customError(err, 500, response)
  }
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
        logger.error(err);
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