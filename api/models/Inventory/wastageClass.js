const { promisifyQuery, rowAffected } = require("../../../helper")
const Inventory = require("./inventoryclass")

class WastageInventory extends Inventory {
  constructor(stockid) {
    super()
    this.stockid = stockid
  }

  /**
   * Calculates the amount of a product that is currently in stock and not used.
   *
   * @param {number} productordersid - The ID of the product order for which to calculate the product in stock.
   * @returns {number|boolean} - The amount of the product that is currently in stock and not used. Returns false if there is no product in stock.
   */
  async calculateProductInstock(productordersid) {
    const debitHx = await this.getDebitHxSingle(productordersid)
    if (debitHx.length === 0) return false

    let data = await promisifyQuery(`SELECT quantityReceived AS qty FROM orders WHERE productordersid = ?`, [productordersid])
    const qtyReceived = data.length > 0 ? data[0]["qty"] : 0
    const totalDebited = debitHx.reduce((p, c, i) => p + c?.debitqty, 0)
    return parseInt(qtyReceived) - parseInt(totalDebited)
  }

  async getOrderWastageData(productordersid) {
    if (!productordersid) {
      throw new Error("productordersid required")
    }
    return await promisifyQuery(`SELECT * FROM generalstoredebithx WHERE productordersid = ? AND wastage = 1`, [productordersid])
  }

  async calcalulateWastageTotal(productordersid) {
    if (!productordersid) return new Error("productordersid required")
    let data = await this.getOrderWastageData(productordersid);
    if (data.length === 0) return 0;
    data = data.reduce((acc, cur) => acc + cur?.debitqty, 0);
    return data
  }

  async updateOrdersWastage(productordersid, state) {
    const updateQ = `UPDATE orders SET expiredDisposed = ?, disposaldate = NOW() WHERE productordersid = ?`
    return await promisifyQuery(updateQ, [state, productordersid])
  }

  async isWastageDebitHxExist(productordersid) {
    const result = await promisifyQuery(`SELECT * FROM generalstoredebithx WHERE wastage = 1 AND productordersid = ?`, [productordersid])
    return result.length > 0
  }

  async disposeoffExpireProduct(records) {
    const { productordersid, brandid, stockid, batchnumber } = records
    if (!productordersid) {
      throw new Error("required keys not found in object provided")
    }
    if (await this.isWastageDebitHxExist(productordersid)) {
      await this.updateOrdersWastage(productordersid, 1)
      return "EXIST"
    }
    const total = await this.calculateProductInstock(productordersid, stockid, brandid)
    const isDebited = await this.addDebitHx(productordersid, stockid, batchnumber, brandid, total, 1)

    if (isDebited) {
      return rowAffected(await this.updateOrdersWastage(productordersid, 1))
    }
    return null
  }
}



module.exports = WastageInventory
