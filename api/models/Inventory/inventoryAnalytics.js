const { promisifyQuery, paginationQuery } = require("../../../helper")
const logger = require("../../../logger")
const Inventory = require("./inventoryclass")

class Inventoryanalytics {
  constructor(stockid, departmentid) {
    this.stockid = stockid
    this.departmentid = departmentid
  }

  async getCustomizationData() {
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

  async getNearExpiry(count) {
    const data = await this.customization()
    const nearExpiry = parseInt(data?.expirydays) + 1 || 22
    const query = `SELECT DISTINCT ${
      count
        ? "COUNT(*) AS count"
        : "productordersid, name,receiveddate,expirydate,quantityReceived,expiredDisposed,batchnumber,brand,stockid"
    } FROM  orders AS o WHERE o.status = 'received' AND DATEDIFF(o.expirydate, CURRENT_DATE()) < ?  AND 
    DATE(CURRENT_DATE ) < DATE(o.expirydate)`
    const rowsCount = await promisifyQuery(query, nearExpiry)
    if (count) {
      return rowsCount.length > 0 ? rowsCount[0]["count"] : 0
    }
    return rowsCount
  }

  async getBelowAlert(count) {
    const query = `SELECT ${count ? "COUNT(*) AS count" : "*"} FROM generalStocks where quantity < alertlevel`
    const data = await promisifyQuery(query)
    if (count) {
      return data.length > 0 ? data[0]["count"] : 0
    }
    return data
  }

  async getExpiredCount(count) {
    const query = `SELECT ${count ? "COUNT(*) AS count" : "*"} FROM orders WHERE RECEIVED = 'TRUE'
    AND status = 'received' AND DATE(expirydate) < CURRENT_DATE`
    const data = await promisifyQuery(query)
    if (count) return data.length > 0 ? data[0]["count"] : 0
    return data
  }

  async getInvSummaryAnalytics() {
    const data = await promisifyQuery(`SELECT * FROM inventoryanalyticssummary`)
    return data.length > 0 ? this.parseJsonData(data[0]["settings"]) : {}
  }

  async getIncompOrdersCount(count) {
    const query = `SELECT ${count === true ? "COUNT(*) AS count" : "*"} FROM orders WHERE received  = 'FALSE'`
    const result = await promisifyQuery(query)
    if (count === true) {
      return result.length > 0 ? result[0]["count"] : null
    }
    return result
  }

  async completeOrdersCount(count, t = { page: 1, count: 10 }) {
    let query = `SELECT  ${count === true ? "COUNT(*) AS count" : "*"} FROM orders WHERE received = 'TRUE'`
    if (count === true) {
      const result = await promisifyQuery(query)
      return result.length > 0 ? result[0]["count"] : 0
    }
    query += ` LIMIT ? OFFSET ?`

    const result = await paginationQuery(t, query)
    return result
  }

  async updateInvenAnalSummary() {
    const updateQ = `UPDATE inventoryanalyticssummary SET settings = ? WHERE id  = 1`
    const insertQ = `INSERT INTO inventoryanalyticssummary (settings) VALUES (?)`
    try {
      const n = await this.getNearExpiry(true)
      const e = await this.getExpiredCount(true)
      const b = await this.getBelowAlert(true)
      const getSettings = await promisifyQuery(`SELECT * FROM inventoryanalyticssummary`)
      const data = JSON.stringify({ nearExpiryCount: n, belowAlertLevel: b, expiredCount: e })
      const isAvail = getSettings.length > 0
      if (isAvail) {
        await promisifyQuery(updateQ, [data])
      } else {
        await promisifyQuery(insertQ, [data])
      }
    } catch (err) {
      logger.error(err)
      throw new Error(err)
    }
  }

  async getWastagePerQuarters(departmentid) {
    let query = `SELECT dhx.productordersid,
    CASE
       WHEN o.pricing = 'unit' THEN (dhx.debitqty * o.price)
       WHEN o.pricing = 'absolute' THEN (dhx.debitqty + o.price) 
    END AS debitAmount,
    CASE
       WHEN MONTH(dhx.debitdate)  BETWEEN 1 AND 4 THEN 1
       WHEN MONTH (dhx.debitdate) BETWEEN 5 AND 8 THEN 2
       WHEN MONTH (dhx.debitdate) BETWEEN 5 AND 8 THEN 3
    END AS quarter,
            o.pricing,
            o.quantityReceived,
            o.price,
            o.totalamount,
            dhx.wastage,
            dhx.debitqty,
            dhx.departmentid
     FROM generalstoredebithx AS dhx INNER JOIN  orders AS o
     ON o.productordersid = dhx.productordersid WHERE dhx.wastage = 1`

    if (departmentid) {
      query += ` AND departmentid = ?`
    }

    let result  = await promisifyQuery(query, [departmentid])
    
    if (result.length === 0) return result;

    const reducer = (data) => {
      return data.reduce((sum, current) => sum + current?.debitAmount, 0);
    }

    const totalWastage = reducer(result);
    
    const firstQ = reducer(result.filter((a, b) => a.quarter === 1));
    const secondQ = reducer(result.filter((a, b) => a.quarter === 2));
    const thirdQ = reducer(result.filter((a, b) => a.quarter === 3));

    return {
      firstQ,secondQ,thirdQ,totalWastage
    }
  }

}

module.exports = Inventoryanalytics

new Inventoryanalytics().getWastagePerQuarters()
