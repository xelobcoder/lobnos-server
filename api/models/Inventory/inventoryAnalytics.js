const { promisifyQuery } = require("../../../helper");
const logger = require("../../../logger")

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
    const query = `SELECT DISTINCT ${count ? "COUNT(*) AS count" : "productordersid, name,receiveddate,expirydate,quantityReceived"} FROM  orders AS o
    INNER JOIN mainstoresupply AS m ON m.stockid = o.stockid
    WHERE o.status = 'received' AND DATEDIFF(o.expirydate, CURRENT_DATE()) < ?  AND o.expiredDisposed IS NULL`
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
    AND status ='received' AND DATE(expirydate) < DATE(NOW())`
    const data = await promisifyQuery(query)
    if (count) return data.length > 0 ? data[0]["count"] : 0
    return data
  }

  async getInvSummaryAnalytics() {
    const data = await promisifyQuery(`SELECT * FROM inventoryanalyticssummary`)
    return data.length > 0 ? this.parseJsonData(data[0]["settings"]) : {}
  }

  async getIncompOrdersCount() {
    const query = `SELECT COUNT(*) AS count FROM orders WHERE received  = 'FALSE'`
    const result = await promisifyQuery(query)
    return result.length > 0 ? result[0]["count"] : null
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
      await promisifyQuery("ROLLBACK")
      logger.error(err)
      throw new Error(err)
    }
  }

  async completeOrdersCount() {
    const query = `SELECT COUNT(*) AS count FROM orders WHERE received = 'TRUE'`
    const result = await promisifyQuery(query)
    return result.length > 0 ? result[0]["count"] : 0
  }

}

module.exports = Inventoryanalytics

new Inventoryanalytics().updateInvenAnalSummary()