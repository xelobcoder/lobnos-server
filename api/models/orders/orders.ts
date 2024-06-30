import { promisifyQuery, customError, rowAffected, paginationQuery } from "../../helper";
import logger from "../../logger";
import connection from "../db";
import Inventory from "./Inventory/inventoryclass";
import * as queries from "./queries"; 

class Orders extends Inventory {
  orderid: string;

  constructor(stockid: string, orderid: string) {
    super(stockid);
    this.orderid = orderid;
  }
}

const placeOrder = async function (request: any, response: any) {
  let successCount = 0;
  let errorCount = 0;
  let Exit: any[] = [];

  const addNewOrder = async (orderTransactionid: number, item: any) => {
    const { quantity, stockid, name, suppliername, supplierid, purchaseunit } = item;
    return promisifyQuery(queries.q_addNewOrder, [quantity, stockid, name, suppliername, supplierid, purchaseunit, orderTransactionid]);
  };

  const checkOrderExist = async (item: any) => {
    const { supplierid, stockid } = item;
    return promisifyQuery(queries.q_checkOrderExist, [stockid, "FALSE", supplierid]);
  };

  const { stock } = request.body;
  const orderTransactionid = Date.now();

  if (Array.isArray(stock) && stock.length > 0) {
    let counter = 0;
    stock.forEach(async (item: any, index: number) => {
      try {
        let present = await checkOrderExist(item);
        let count = present[0]?.count;
        if (present && count > 0) {
          Exit.push(item);
        } else {
          let added = await addNewOrder(orderTransactionid, item);
          const affectedRows = added?.affectedRows;
          if (affectedRows === 1) successCount++;
        }
      } catch (err) {
        logger.error(err);
        errorCount++;
      }
      counter++;
      if (counter === stock.length) {
        let responseString = ``;
        Exit.forEach((item, index) => {
          const { suppliername, name, stockid } = item;
          responseString += `${name} with stockid ${stockid} request to ${suppliername} was earlier on requested but remained unresolved, hence not added,`;
        });
        response.send({
          statusCode: 200,
          status: "success",
          clear: Exit.length,
          message: `${successCount} items successfully requested. ${errorCount} error occurred. ${responseString}`,
        });
      }
    });
  }
};

const getOrders = async function (request: any, response: any) {
  const { orderTransactionid, includebrands } = request.query;
  const queryValues: any[] = [];
  let query = queries.q_getOrders;

  if (orderTransactionid) {
    query += ` AND orderTransactionid = ?`;
    queryValues.push(orderTransactionid);
  }
  query += ` ORDER BY productordersid DESC LIMIT ? OFFSET ?`;

  try {
    let result: any = {};
    result.products = await paginationQuery(request.query, query, queryValues);

    if (includebrands) {
      const getbrands = result.products.map((item: any, index: number) => item.stockid);

      if (getbrands.length > 0) {
        const stocksBrands = await promisifyQuery(queries.q_getStockBrands, [getbrands]);
        result.stockBrands = stocksBrands;
      } else {
        result.stockBrands = [];
      }
    }
    response.send({ result, status: "success", statusCode: 200 });
  } catch (err) {
    customError(err, 500, response);
  }
};

const deleteAspecificOrder = function (orderid: number, response: any) {
  const query = queries.q_deleteOrder;
  connection.query(query, [orderid], function (err: any, result: any) {
    if (err) {
      console.log(err);
      response.send({
        status: "error",
        err,
      });
    }
    if (result) {
      response.send({
        status: "success",
        message: "Order deleted successfully",
        statusCode: 200,
      });
    }
  });
};

const updateStock = async function (stockid: string, planned: number, request: any, response: any) {
  return new Promise((resolve, reject) => {
    const query = queries.q_updateStock;
    connection.query(query, [stockid], function (err: any, result: any) {
      if (err) {
        reject(err);
      }
      if (result) {
        const { stockid, quantity } = result[0];
        const updatedQuantity = parseInt(quantity) + parseInt(planned);
        const updateQuery = queries.q_updateGeneralStocks;
        connection.query(updateQuery, [updatedQuantity, stockid], function (err: any, result: any) {
          if (err) {
            reject(err);
          }
          if (result) {
            resolve(result);
          }
        });
      }
    });
  });
};

const updateOrders = function (data: any) {
  const query = queries.q_updateOrders;
  return promisifyQuery(query, data);
};

const addToStockTransactions = async function (data: any[]) {
  if (Array.isArray(data) && data.length > 0) {
    const query = queries.q_addToStockTransactions;
    connection.query(query, data, function (err: any, result: any) {
      if (err) {
        logger.error(err);
      }
      if (result) {
        console.log("Stock transaction added successfully");
      }
    });
  }
};

const updateOrderReceivedTransactionSummary = async function (summary: any) {
  const { orderTransactionid, method, amount, total } = summary;
  if (parseFloat(amount) < 0 || parseFloat(total) < 0 || !orderTransactionid) return false;
  const query = queries.q_updateOrderReceivedTransactionSummary;
  const values = [method, total, amount, orderTransactionid];
  rowAffected(await promisifyQuery(query, values));
};

export { placeOrder, getOrders, deleteAspecificOrder };
