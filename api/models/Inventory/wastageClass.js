const { promisifyQuery } = require("../../../helper")
const Inventory = require("./inventoryclass")

class WastageInventory extends Inventory {
  constructor(stockid) {
    super()
    this.stockid = stockid
  }

  async calculateProductInstock(productordersid) {
    // get amount in stock and not used
    const debitHx = await this.getDebitHxSingle(productordersid)
    if (debitHx.length === 0) return false

    let data = await promisifyQuery(`SELECT quantityReceived AS qty FROM orders WHERE productordersid = ?`, [productordersid])
    const qtyReceived = data.length > 0 ? data[0]["qty"] : 0
    const totalDebited = debitHx.reduce((p, c, i) => p + c?.debitqty, 0)
    return parseInt(qtyReceived) - parseInt(totalDebited)
  }

  async disposeoffExpireProduct(records) {
    const { productordersid, brand, brandid, stockid, batchnumber } = records
    if (!productordersid) {
      throw new Error("required keys not found in object provided")
    }
    const total = await this.calculateProductInstock(productordersid, stockid, brandid)

    const isDebited = await this.addDebitHx(productordersid, stockid, batchnumber, brandid, total, 1)
    console.log(isDebited)
  }
}

module.exports = WastageInventory
