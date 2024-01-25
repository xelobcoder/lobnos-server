const { promisifyQuery } = require("../../../helper");

class Inventoryanalytics {
  constructor(stockid,departmentid) {
    this.stockid = stockid;
    this.departmentid = departmentid;
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
    const nearExpiry = parseInt(data?.expirydays) + 1 || 22
    const query = `SELECT COUNT(*) AS count FROM  orders AS o
    INNER JOIN mainstoresupply AS m ON m.stockid = o.stockid
    WHERE o.status = 'received' AND DATEDIFF(o.expirydate, CURRENT_DATE()) < ?;
    `;
    const rowsCount = await promisifyQuery(query, nearExpiry);
    return rowsCount.length > 0 ? rowsCount[0]['count'] : 0;
  }

  async getBelowAlert() {
    const query = `SELECT COUNT(*) AS count FROM generalStocks where quantity < alertlevel`;
    const data = await promisifyQuery(query);
    return data.length > 0 ? data[0]['count'] : 0;
  }

  async getExpiredCount() {
    const query = `SELECT COUNT(*) AS count FROM orders WHERE RECEIVED = 'TRUE'
    AND status ='received' AND DATE(expirydate) < DATE(NOW())`;
    const data = await promisifyQuery(query);
    return data.length > 0 ? data[0]['count'] : 0;
  }
}


module.exports = Inventoryanalytics;