const Inventoryanalytics = require("./inventoryAnalytics")
const Wastage = require("./wastageClass")
const analytics = new Inventoryanalytics()
const wastage = new Wastage()

const urgentActions = async (action, response) => {
  if (action === "nearexpiry") {
    let result = await analytics.getNearExpiry()
    result = await Promise.all(
      result.map(async (item, index) => {
        const tt = await wastage.calculateProductInstock(item?.productordersid)
        return { ...item, qty_in_stock: tt }
      })
    )
    response.send({ result, status: "success" })
  } else if (action === "expired") {
    let result = await analytics.getExpiredCount()
    result = result.map(async (item, index) => {
      const { productordersid, batchnumber, receiveddate, expirydate, quantityReceived, name, expiredDisposed } = item
      let amtInstock = 0
      if (expiredDisposed === 1) {
        amtInstock = await wastage.calcalulateWastageTotal(productordersid)
      } else {
        const tt = await wastage.calculateProductInstock(productordersid)
        amtInstock = tt
      }
      return { receiveddate, batchnumber, expirydate, quantityReceived, name, expiredqty: amtInstock, expiredDisposed }
    })
    result = await Promise.all(result)
    response.send({ result, status: "success" })
  } else if (action === "belowalert") {
    const result = await analytics.getBelowAlert()
    response.send({ result, status: "success" })
  } else if (action === "uncompletedorders") {
    const result = await analytics.getIncompOrdersCount()
    response.send({ result, status: "success" })
  } else if (action === "completedorders") {
    const result = await analytics.completeOrdersCount()
    response.send({ result, status: "success" })
  } else {
    response.send({ result: [], status: "warning" })
  }
}

module.exports = urgentActions
