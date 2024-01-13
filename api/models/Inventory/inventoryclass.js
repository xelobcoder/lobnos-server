const { rowAffected, paginationQuery, promisifyQuery } = require("../../../helper");
const database_queries = require("../../database/queries");
const NEWSTOCKQUERY = `INSERT INTO generalstocks (name,category,consumptionunit,purchaseunit,quantity,alertlevel,materialcode,warehouse,shelf) VALUES (?,?,?,?,?,?,?,?,?)`;
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
                      INNER JOIN shelves AS sh ON sh.id = ns.shelf `;

const EXPIREDSTOCKSQUERY = `SELECT productordersid, stockid, quantity, expirydate, received, receiveddate, expirydate, Batchnumber, name, suppliername, purchaseunit FROM orders WHERE RECEIVED = 'TRUE' AND DATE(expirydate) < DATE(NOW()) ORDER BY expirydate ASC LIMIT ? OFFSET ?`;

const GENERALUNEXPIREDSTOCKS = `SELECT * FROM generalstocks WHERE expirydate >= NOW() AND status = 'received' ORDER BY productordersid LIMIT ? OFFSET ?`;

const UPDATEASTOCKQUERY = `UPDATE generalstocks SET  consumptionunit = ?,  purchaseunit = ?,  alertlevel = ?,  materialcode = ?,  date = ?,  name = ?,  category = ?,warehouse = ? , shelf = ? WHERE stockid = ?`;

const DELETEASTOCKQUERY = `DELETE FROM newstock WHERE stockid = ?`;

const FILTERSTOCKQUERY = `SELECT 
        gs.stockid,
        gs.name,
        sc.category,
        gs.consumptionunit,
        gs.quantity
    FROM generalstocks AS gs
    INNER JOIN stockcategory AS  sc ON sc.id = gs.category
    WHERE gs.name  LIKE ? OR sc.category LIKE ? ORDER BY gs.name LIMIT ? OFFSET ?`;

class Inventory {
  constructor(stockid) {
    this.stockid = stockid || null;
  }

  async checkStockExist(stockname) {
    const item = await promisifyQuery(`SELECT * FROM generalstocks WHERE name = ?`, [stockname]);
    return item.length > 0;
  }

 async  addNewStock(records) {
   const { name, category, consumptionunit, purchaseunit, quantity, alertlevel, materialcode,warehouse,shelf } = records;
   if (await this.checkStockExist(name)) return 'EXIST';

   if (!category  || typeof category != 'number' || !name) throw new Error("category of type number required and name required");
   const values = [name, category, consumptionunit, purchaseunit, quantity, alertlevel, materialcode, warehouse, shelf];
   
   const pushStock = await promisifyQuery(NEWSTOCKQUERY, values);
   return rowAffected(pushStock);
  }

  async updateAstock(records) {
    const { stockid, name, category, consumptionunit, purchaseunit,  alertlevel, materialcode,
     warehouse,shelf, date } = records;
    if (!stockid) throw new Error("stockid required");
    if (!category || typeof category != 'number' || !(category > 0)) throw new Error('category must be a number greater than 0');
    const values = [consumptionunit, purchaseunit, alertlevel, materialcode, date, name, category, warehouse, shelf,stockid];
    const update = await promisifyQuery(UPDATEASTOCKQUERY, values);
    return rowAffected(update);
  }

    async deleteAstock(stockid) {
      if (!stockid || typeof stockid !== 'number') throw new Error("stockid required");

      return await promisifyQuery(DELETEASTOCKQUERY, [parseInt(stockid)])
  }

  async getStocks(query, warehouseid) {
    let data = [];
    let newQuery = GETGENERALSTOCK
    if (warehouseid && warehouseid != 'all') {
      newQuery += ` WHERE warehouse = ?  ORDER BY ns.stockid LIMIT ? OFFSET ?`;
      data = await paginationQuery(query, GETGENERALSTOCK,[parseInt(warehouseid)]);
      return data;
    }
    newQuery += `ORDER by ns.stockid LIMIT ? OFFSET ?`
    data = await paginationQuery(query,GETGENERALSTOCK);
    return data;
  } 

  async getAstock(stockid) {
    if (!stockid) return;
    return await promisifyQuery(`SELECT * FROM generalstocks WHERE stockid = ?`, [stockid]);
  }

  async getExpiredStock(query) {
    return await paginationQuery(query, EXPIREDSTOCKSQUERY);
  }

  async addStockCategory(records) {
      const { category } = records;
      if (!category || typeof category != "string") throw new Error("Must be of type string and category required");
      const stockAvailable = await promisifyQuery('SELECT * FROM stockcategory WHERE category = ?', [category]);
      if (stockAvailable.length > 0) return false;
      const insertion = await promisifyQuery('INSERT INTO stockcategory (category) VALUES ?', [category]);
      return insertion.affectedRows > 0;
  }

  async getStockCategory() {
    return await promisifyQuery(`SELECT * FROM stockcategory`);
    }

    async deleteStockCategory(stockid) {
        if (!stockid) throw new Error("stockid required");
        const isdeleted = await database_queries.del(id, "stockcategory", "id");
        return rowAffected(isdeleted);
    }

  async getGeneralUnExpiredStocks(requestQuery) {
    return await paginationQuery(requestQuery,GENERALUNEXPIREDSTOCKS);
  }

  async getGeneralExpired(query) {
    return await paginationQuery(query, EXPIREDSTOCKSQUERY);
  }

    async filterstock(filteringValue) {
        if (!filteringValue) return [];
      let data = await paginationQuery({},FILTERSTOCKQUERY, [filteringValue, filteringValue]);
        if (data.length === 0) return data;
        data.map((item, index) => { return { ...item, quantityrequired: 0 } });
        return data;
  }
}


module.exports = Inventory;