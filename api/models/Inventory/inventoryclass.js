const { rowAffected, paginationQuery, promisifyQuery, customError } = require("../../../helper");
const logger = require("../../../logger");
const database_queries = require("../../database/queries");
const connection = require("../../db");
const connectionpool = require("../../dbpool");
const NEWSTOCKQUERY = `INSERT INTO generalstocks (name,category,consumptionunit,purchaseunit,quantity,alertlevel,materialcode,warehouse,shelf) VALUES (?,?,?,?,?,?,?,?,?)`;
const DELETESTOCKABRANDQUERY = 'DELETE FROM stocksbrands WHERE stockid = ? && brandid = ?';
const GETGENERALSTOCK = ` SELECT 
                      ns.name as name,
                      ns.stockid as stockid,
                      sc.category as categoryname,
                      ns.consumptionunit as consumptionunit,
                      ns.purchaseunit as purchaseunit,
                      ns.quantity as quantity,
                      ns.date as date,
                      wc.id as warehouse,
                      sc.id as category,
                      sh.id as shelf,
                      ns.alertlevel as alertlevel,
                      ns.materialcode as materialcode
                      FROM generalstocks AS ns INNER JOIN stockcategory AS sc ON sc.id = ns.category
                      INNER JOIN warehouse AS wc ON ns.warehouse = wc.id
                      INNER JOIN shelves AS sh ON sh.id = ns.shelf`

const EXPIREDSTOCKSQUERY = `SELECT productordersid, stockid, quantity, expirydate, received, receiveddate, expirydate, Batchnumber, name, suppliername, purchaseunit FROM orders WHERE RECEIVED = 'TRUE' AND DATE(expirydate) < DATE(NOW()) ORDER BY expirydate ASC LIMIT ? OFFSET ?`

const GENERALUNEXPIREDSTOCKS = `SELECT * FROM generalstocks WHERE expirydate >= NOW() AND status = 'received' ORDER BY productordersid LIMIT ? OFFSET ?`

const UPDATEASTOCKQUERY = `UPDATE generalstocks SET  consumptionunit = ?,  purchaseunit = ?,  alertlevel = ?,  materialcode = ?,  date = ?,  name = ?,  category = ?,warehouse = ? , shelf = ? WHERE stockid = ?`

const DELETEASTOCKQUERY = `DELETE FROM newstock WHERE stockid = ?`

const FILTERSTOCKQUERY = `SELECT 
        gs.stockid,
        gs.name,
        gs.date,
        sc.category,
        gs.consumptionunit,
        gs.alertlevel,
        sc.category AS categoryname,
        gs.quantity
    FROM generalstocks AS gs
    INNER JOIN stockcategory AS  sc ON sc.id = gs.category
    WHERE gs.name  LIKE ? OR sc.category LIKE ? `

class Inventory {
  constructor(stockid) {
    this.stockid = stockid || null
  }

  async checkStockExist(stockname) {
    const item = await promisifyQuery(`SELECT * FROM generalstocks WHERE name = ?`, [stockname])
    return item.length > 0
  }

  async addNewStock(records) {
    const { name, category, consumptionunit, purchaseunit, quantity, alertlevel, materialcode, warehouse, shelf } = records
    if (await this.checkStockExist(name)) return "EXIST"

    if (!category || typeof category != "number" || !name) throw new Error("category of type number required and name required")
    const values = [name, category, consumptionunit, purchaseunit, quantity, alertlevel, materialcode, warehouse, shelf]

    const pushStock = await promisifyQuery(NEWSTOCKQUERY, values)
    return rowAffected(pushStock)
  }

  async updateAstock(records) {
    const { stockid, name, category, consumptionunit, purchaseunit, alertlevel, materialcode, warehouse, shelf, date } = records
    if (!stockid) throw new Error("stockid required")
    if (!category || typeof category != "number" || !(category > 0)) throw new Error("category must be a number greater than 0")
    const values = [consumptionunit, purchaseunit, alertlevel, materialcode, date, name, category, warehouse, shelf, stockid]
    const update = await promisifyQuery(UPDATEASTOCKQUERY, values)
    return rowAffected(update)
  }

  async deleteAstock(stockid) {
    if (!stockid || typeof stockid !== "number") throw new Error("stockid required")
    return await promisifyQuery(DELETEASTOCKQUERY, [parseInt(stockid)])
  }

  async getStocks(query, warehouseid) {
    let data = []
    let newQuery = GETGENERALSTOCK
    if (warehouseid && warehouseid != "all") {
      newQuery += ` WHERE ns.warehouse = ? LIMIT ? OFFSET ?`
      data = await paginationQuery(query,newQuery, [parseInt(warehouseid)]);
      return data
    }
    newQuery += ` LIMIT ? OFFSET ?`
    return await paginationQuery(query,newQuery);
  }

  async getAstock(stockid) {
    if (!stockid) return
    return await promisifyQuery(`SELECT * FROM generalstocks WHERE stockid = ?`, [stockid])
  }

  async getExpiredStock(query) {
    return await paginationQuery(query, EXPIREDSTOCKSQUERY)
  }

  async addStockCategory(records) {
    const { category } = records
    if (!category || typeof category != "string") throw new Error("Must be of type string and category required")
    const stockAvailable = await promisifyQuery("SELECT * FROM stockcategory WHERE category = ?", [category])
    if (stockAvailable.length > 0) return 1;
    const insertion = await promisifyQuery("INSERT INTO stockcategory (category) VALUE (?)", [category])
    return rowAffected(insertion);
  }

  async getStockCategory() {
    return await promisifyQuery(`SELECT * FROM stockcategory`)
  }

  async updateStockCategory(records) {
    const { id, category } = records;
    if (!id || !category) throw new Error('category and id required');
    const stockAvailable = await promisifyQuery("SELECT * FROM stockcategory WHERE category = ?", [category])
    if (stockAvailable.length === 0) return 1;
    const updateCat = await promisifyQuery('UPDATE stockcategory SET category = ? WHERE id = ?', [category, parseInt(id)]);
    return rowAffected(updateCat);
  }

  async deleteStockCategory(stockid) {
    if (!stockid) throw new Error("stockid required")
    const isdeleted = await database_queries.del(stockid, "stockcategory", "id")
    return rowAffected(isdeleted)
  }

  async getGeneralUnExpiredStocks(requestQuery) {
    return await paginationQuery(requestQuery, GENERALUNEXPIREDSTOCKS)
  }

  async getGeneralExpired(query) {
    return await paginationQuery(query, EXPIREDSTOCKSQUERY)
  }

  async deleteStockBrand(records) {
    const { stockid, brandid } = records;
    if (!stockid || !brandid) return "stockid and brandid are required";

    const deleteResult = await promisifyQuery(DELETESTOCKABRANDQUERY, [stockid,brandid]);

    return rowAffected(deleteResult);
  }

  async getAstockBrands(records) {
    const { count, page, stockid } = records;
    if (!stockid) throw new Error("stockid not provided");
    const result = await paginationQuery({ count, page }, `SELECT * FROM stocksbrands WHERE stockid = ? LIMIT ? OFFSET ?`,[stockid]);
    return result;
  }

  async addStockBrand(records) {
    const { brand, stockid } = records;

    if (!brand || !stockid) throw new Error('brand name and stockid required');

    const ADDSTOCKBRAND = `INSERT INTO stocksbrands (brand,stockid) VALUES (?,?)`;

    return rowAffected(await promisifyQuery(ADDSTOCKBRAND, [brand, stockid]));
  }

  async updateAStockBrand(records) {
    const { brand, stockid, brandid } = records;

    if (!brand || !stockid || !brandid) {
      throw new Error('brand,brandid and stockid are all required');
    }

    const UPDATESTOCKBRANDQUERY = `UPDATE stocksbrands SET brand = ? WHERE stockid = ? AND brandid = ?`;

    const isUpdated = await promisifyQuery(UPDATESTOCKBRANDQUERY, [brand,stockid, brandid]);

    return rowAffected(isUpdated);
  }
 
  async filterstock(filteringValue, query) {
    let SQLQUERY = FILTERSTOCKQUERY;
    if (!filteringValue) return []
    let values = [filteringValue,filteringValue]
    const { warehouseid } = query;
    if (warehouseid && warehouseid != 'all') {
      SQLQUERY += ` AND gs.warehouse = ?`;
      values.push(parseInt(warehouseid))
    }
    SQLQUERY += ` ORDER BY gs.name LIMIT ? OFFSET ?`;
    let data = await paginationQuery(query, SQLQUERY, values);

    if (data.length === 0) return data
    data.map((item, index) => {
      return { ...item, quantityrequired: 0 }
    })

    return data
  }

  async getCustomizationData(response) {
    return await promisifyQuery(`SELECT * FROM inventoryCustomization`)
  }

  parseJsonData(data) {
    if (data === "{}" || data === null || data === undefined) return false
    return JSON.parse(data)
  }

  async customization() {
    const unparsed = await this.getCustomizationData()
    if (unparsed.length === 0) return
    const { settings } = unparsed[0]

    return this.parseJsonData(settings)
  }

  async getNearExpiry() {
    const data = await this.customization()
    const nearExpiry = parseInt(data?.expirydays) || 21
    console.log(nearExpiry, data);
  }

  async updateStockOrders (data) {
    const query = `UPDATE orders SET received = ?, quantityReceived = ?, receiveddate = ?, status = ?, expirydate = ?,
     batchnumber = ?, balance = ?,brand = ? , price = ?, totalamount = ? WHERE productordersid = ? AND orderTransactionid = ? AND stockid =?`;
    return promisifyQuery(query, data);
  }
  
  async updateOrderReceivedTransactionSummary  (summary) {
    const { orderTransactionid, method, amount, total } = summary;
    if (parseFloat(amount) < 0 || 
    parseFloat(total) < 0 ||!orderTransactionid) return false;
    const query = `UPDATE orderreceivedaccountsummary SET method  = ?,debit = ?, taxAmount = ?,updatedOn=NOW()  WHERE orderTransactionid = ?`
    const values = [method, total, amount, orderTransactionid];
    return await promisifyQuery(query, values);
  }

  async receivePurchaseStocks(records, total, tax, response) {
    try { 
      if (records.length === 0) {
        if (response) {
          customError("data must contain an array of products", 500, response);
          return;
        } else {
          throw new Error("data must be greater than 0");
        }
      };

      if (!tax || !Object.keys(tax).includes("amount") || !Object.keys(tax).includes("method")) {
        if (response) {
          customError("Tax is an object with properties amount and method", 500, response);
          return;
        } else {
          throw new Error("Tax is an object with properties amount and method")
        }
      } 

    const { orderTransactionid } = records[0];
    const requiredDataSource = records.map((item, index) => {
      const { productordersid, received, quantityReceived, receiveddate, status, expirydate,
        batchnumber, balance, brandid, price, totalamount, orderTransactionid, stockid
      } = item;

      return [received, quantityReceived, receiveddate, status, expirydate, batchnumber, balance, parseInt(brandid), parseFloat(price), parseFloat(totalamount), productordersid, orderTransactionid, stockid];
    });

  
    let successCount = 0;
    let errorCount = 0;
    let current = 0;
    let ordersSummaryUpdated = false;

    while (current < records.length) {
      const updateRecord = await this.updateStockOrders(requiredDataSource[current]);
      rowAffected(updateRecord) ? successCount++ : errorCount++;
      current++;
    }

    if (successCount === records.length) {
      const summary = {
        orderTransactionid,
        total: parseFloat(total),
        method: tax?.method,
        amount: parseFloat(tax?.amount),
      }
      
      const updateSummary = await this.updateOrderReceivedTransactionSummary(summary);     
      ordersSummaryUpdated = rowAffected(updateSummary);
    }

      return !response ?
        ordersSummaryUpdated :
        response.send({ message: 'order updated successfully', statusCode: 200, status: 'success' });
      
    } catch (err) {
      logger.error( err)
      throw new Error(err);
    }
  }
}

module.exports = Inventory

