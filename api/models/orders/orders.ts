import { promisifyQuery, customError, rowAffected, paginationQuery } from "../../../helper";
import logger from "./../../../logger";
import Inventory from "../../models/Inventory/inventoryClass/inventoryClass";
import * as queries from "./queries";

export class Orders extends Inventory {
  orderid: number;

  constructor(stockid: number, orderid: number) {
    super(stockid);
    this.orderid = orderid;
  }
}

export const placeOrder = async function (request: any, response: any) {
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


type RequestQuery = {
  page: number,
  count: number,
  orderTransactionid: number,
  includebrands: boolean
}
export const getOrders = async function (data: RequestQuery) {
  const { orderTransactionid, includebrands, page, count } = data;
  const queryValues: any[] = [];
  let query = queries.q_getOrders;

  if (orderTransactionid) {
    query += ` AND orderTransactionid = ?`;
    queryValues.push(orderTransactionid);
  }
  query += ` ORDER BY productordersid DESC LIMIT ? OFFSET ?`;

  try {
    let result: any = {};
    result.products = await paginationQuery({ count, page }, query, queryValues);

    if (includebrands) {
      const getbrands = result.products.map((item: any, index: number) => item.stockid);

      if (getbrands.length > 0) {
        const stocksBrands = await promisifyQuery(queries.q_getStockBrands, [getbrands]);
        result.stockBrands = stocksBrands;
      } else {
        result.stockBrands = [];
      }
    }
    return result;
  } catch (err) {
    throw new Error(err);
  }
};

export const deleteAspecificOrder = async function (orderid: number, response: any) {
  const query = queries.q_deleteOrder;
  return await rowAffected(promisifyQuery(query, [orderid]));
  // connection.query(query, [orderid], function (err: any, result: any) {
  //   if (err) {
  //     console.log(err);
  //     response.send({
  //       status: "error",
  //       err,
  //     });
  //   }
  //   if (result) {
  //     response.send({
  //       status: "success",
  //       message: "Order deleted successfully",
  //       statusCode: 200,
  //     });
  //   }
  // });
};

export const updateStock = async function (stockid: number, planned: number, request: any, response: any): Promise<boolean> {
  const query = queries.q_updateStock;
  const result = await promisifyQuery(query, [stockid]);
  if (updateStock) {
    const { stockid, quantity } = result[0];
    const updatedQuantity = parseInt(quantity) + planned;
    const is_updated = await promisifyQuery(queries.q_updateGeneralStocks, [updatedQuantity, stockid]);
    return rowAffected(is_updated);
  }
};

export const updateOrders = function (data: any) {
  const query = queries.q_updateOrders;
  return promisifyQuery(query, data);
};

export const addToStockTransactions = async function (data: any[]) {
  if (Array.isArray(data) && data.length > 0) {
    await promisifyQuery(queries);
    console.log("Stock transaction added successfully");
  }
};

export const updateOrderReceivedTransactionSummary = async function (summary: any) {
  const { orderTransactionid, method, amount, total } = summary;
  if (parseFloat(amount) < 0 || parseFloat(total) < 0 || !orderTransactionid) return false;
  const query = queries.q_updateOrderReceivedTransactionSummary;
  const values = [method, total, amount, orderTransactionid];
  rowAffected(await promisifyQuery(query, values));
};
