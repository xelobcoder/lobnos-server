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

  async getNearExpiry() {
    const data = await this.customization()
    const nearExpiry = parseInt(data?.expirydays) + 1 || 22
    const query = `SELECT COUNT(*) AS count FROM  orders AS o
    INNER JOIN mainstoresupply AS m ON m.stockid = o.stockid
    WHERE o.status = 'received' AND DATEDIFF(o.expirydate, CURRENT_DATE()) < ?;
    `
    const rowsCount = await promisifyQuery(query, nearExpiry)
    return rowsCount.length > 0 ? rowsCount[0]["count"] : 0
  }

  async getBelowAlert() {
    const query = `SELECT COUNT(*) AS count FROM generalStocks where quantity < alertlevel`
    const data = await promisifyQuery(query)
    return data.length > 0 ? data[0]["count"] : 0
  }

  async getExpiredCount() {
    const query = `SELECT COUNT(*) AS count FROM orders WHERE RECEIVED = 'TRUE'
    AND status ='received' AND DATE(expirydate) < DATE(NOW())`
    const data = await promisifyQuery(query)
    return data.length > 0 ? data[0]["count"] : 0
  }

  async getInvSummaryAnalytics() {
    return await promisifyQuery(`SELECT * FROM inventoryanalyticssummary`)
  }

  async updateInvenAnalSummary() {
    const updateQ = `UPDATE inventoryanalyticssummary
    SET nearExpiryCount = ?,expiredCount = ?,belowAlertLevel = ?
    WHERE id  = 1`
    const insertQ = `INSERT INTO inventoryanalyticssummary (nearExpiryCount,expiredCount,belowAlertLevel) VALUES (?,?,?)`
    try {
      const n = await this.getNearExpiry()
      const e = await this.getExpiredCount()
      const b = await this.getBelowAlert()
      const isAvail = (await this.getInvSummaryAnalytics()).length > 0

      if (isAvail) {
        await promisifyQuery(updateQ, [n, e, b])
      } else {
        await promisifyQuery(insertQ, [n, e, b])
      }
    } catch (err) {
      await promisifyQuery("ROLLBACK")
      logger.error(err)
      throw new Error(err)
    }
  }
}

module.exports = Inventoryanalytics
