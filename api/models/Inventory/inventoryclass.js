const { rowAffected, paginationQuery, promisifyQuery } = require("../../../helper")
const database_queries = require("../../database/queries")
const NEWSTOCKQUERY = `INSERT INTO generalstocks (name,category,consumptionunit,purchaseunit,quantity,alertlevel,materialcode,warehouse,shelf) VALUES (?,?,?,?,?,?,?,?,?)`
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
}

module.exports = Inventory

new Inventory().getNearExpiry()
