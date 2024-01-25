const { promisifyQuery, rowAffected } = require("../../../helper")
const logger = require("../../../logger")
const database_queries = require("../../database/queries")
const Escrow = require("../Inventory/esrow")
const Inventory = require("./../Inventory/inventoryclass")

class Departments {
  constructor(departmentid) {
    this.departmentid = departmentid
  }

  async getPendingdepartmentReqSummary() {
    let query = `SELECT COUNT(hx.id) AS pending,hx.departmentid,d.department
    FROM departmentrequisition AS hx INNER JOIN departments AS d ON hx.departmentid = d.id WHERE quantity_approved IS NULL`
    if (this.departmentid) {
      query += ` AND departmentid = ?`
    }
    query += ` GROUP BY hx.departmentid`
    return await promisifyQuery(query, [this.departmentid])
  }

  async getDeptSpecificReqData(id, type) {
    try {
      // join department requisition table with  name of department  table and name of newstock table
      if (!id) return new Error("id required")

      let mysql_query = `SELECT  drh.id,
                        drh.departmentid, 
                        drh.stockid, 
                        drh.quantity_requested,
                        drh.quantity_approved,
                        drh.status,
                        drh.date,
                        drh.comsumptionunit,
                        d.department,ns.stockid,
                        ns.name,
                        ns.quantity
                        FROM departmentrequisition AS drh
              INNER JOIN departments AS d ON d.id = drh.departmentid
              INNER JOIN generalstocks AS ns ON ns.stockid = drh.stockid`

      if (type === "pending") {
        mysql_query += ` WHERE drh.departmentid = ? AND quantity_approved IS NULL AND store_supplied = 0 `
      }

      if (type === "approved") {
        mysql_query += ` WHERE drh.departmentid = ? AND quantity_approved IS NOT NULL AND status = 'approved' AND store_supplied = 0`
      }

      if (type === "rejected") {
        mysql_query += ` WHERE drh.departmentid = ? AND quantity_approved IS NOT NULL AND status = 'rejected'`
      }

      if (type === "received") {
        mysql_query += ` WHERE drh.departmentid = ? AND quantity_approved IS NOT NULL AND status = 'received'`
      }

      if (type === "receiving") {
        mysql_query += ` WHERE drh.departmentid = ? AND quantity_approved IS NOT NULL AND status = 'approved' AND store_supplied = 1`
      }

      return promisifyQuery(mysql_query, [parseInt(id)])
    } catch (err) {
      throw new Error(err)
    }
  }

  async StoreServeDeptReq() {
    if (!this.departmentid) return new Error("Departmentid Required")

    const pendingReqt = await this.getDeptSpecificReqData(this.departmentid, "approved")
    let stockidx = []

    if (pendingReqt.length == 0) return pendingReqt

    stockidx = pendingReqt.map((reqt, index) => parseInt(reqt.stockid))

    if (stockidx.length === 0) return []

    const inventory = new Inventory()
    const outPromise = (data) => Promise.all(data)
    const stockBrandsArray = stockidx.map(async (a, i) => {
      // get individual stocks brands using their id (s).
      const data = await inventory.getAstockBrands({ stockid: a })
      const stkbrand = data.map((x, y) => {
        return x?.brandid
      })
      return { stockid: a, brands: stkbrand }
    })

    const stocksbrands = await outPromise(stockBrandsArray)
    const haveBrands = stocksbrands.filter((a, i) => a.brands.length > 0)

    let products = []

    if (haveBrands.length > 0) {
      products = haveBrands.map(async (u, v) => {
        const { stockid, brands } = u
        const debithx = await promisifyQuery(
          `SELECT * FROM generalstoredebithx WHERE stockid = ${stockid} AND brandid IN (${brands.join(",")})`
        )
        return { ...u, debithx }
      })

      products = await outPromise(products)

      // if debit hx is empty,it means the credit stock hasnt been used so we send the credit hx
      products = products.map(async (v, i) => {
        const { debithx, stockid, brands } = v
        const data = {}
        if (debithx.length == 0) {
          const credithx = await promisifyQuery(`SELECT * FROM generalstorecredithx
            AS chx INNER JOIN stocksbrands AS sb ON sb.brandid = chx.brandid WHERE chx.stockid = ${stockid} AND chx.brandid IN (${brands.join(
            ","
          )})`)
          data.stockid = stockid
          data.debitable = credithx
        }
        if (debithx.length > 0) {
          let debitable = await inventory.isDebitable(stockid, brands)
          const debitableBrands = debitable.map((x, y) => x?.brandid)

          const creditBrands = []

          for (let i = 0; i < brands.length; i++) {
            if (!debitableBrands.includes(brands[i])) creditBrands.push(brands[i])
          }

          let unCapturedDebitable = []

          if (creditBrands.length > 0) {
            unCapturedDebitable = await promisifyQuery(`SELECT * FROM generalstorecredithx
            AS chx INNER JOIN stocksbrands AS sb ON sb.brandid = chx.brandid WHERE chx.stockid = ${stockid} AND chx.brandid IN (${
              creditBrands.length === 1 ? creditBrands[0] : creditBrands.join(",")
            })`)
          }

          data.stockid = stockid
          data.debitable = [...debitable, ...unCapturedDebitable]
        }

        data.debitable = data.debitable.map((item, index) => {
          if (!item?.storeQty) {
            const { productordersid, stockid, credit, brandid, batchnumber, brand } = item
            return { storeQty: credit, productordersid, stockid, brandid, batchnumber, brand }
          }
          return item
        })
        return data
      })
      products = (await outPromise(products)).filter((u, v) => u.debitable.length > 0)
    }

    for (let i = 0; i < pendingReqt.length; i++) {
      for (let j = 0; j < products.length; j++) {
        const toRemove = ["quantity,requisitionid", "brand", "batchnumber"]
        if (pendingReqt[i]["stockid"] === products[j]["stockid"]) {
          pendingReqt[i]["debitable"] = products[j]["debitable"]
          toRemove.map((item, index) => delete pendingReqt[i][item])
        }
      }
    }

    return pendingReqt
  }

  async checkStoreSuppliedAlready(requisitionid) {
    if (!requisitionid) throw new Error("requisition id is required")

    const CHECKQUERY = `SELECT store_supplied FROM departmentrequisition WHERE id = ?`

    const row = await promisifyQuery(CHECKQUERY, [requisitionid])

    return row[0]["store_supplied"] == 1
  }

  async addProductEscrow(productordersid, stockid, brandid, batchnumber, qty, type, requisitionid, departmentid) {
    const newEscrowQuery = `
      INSERT INTO stocksEsrow (productordersid, stockid, brandid, batchnumber, qty, type,requisitionid,departmentid)
      VALUES (?, ?, ?, ?, ?, ?,?,?)
    `

    return await promisifyQuery(newEscrowQuery, [productordersid, stockid, brandid, batchnumber, qty, type, requisitionid, departmentid])
  }

  async checkEscrowOrderExists(productordersid, stockid, brandid, batchnumber) {
    const checkEscrowQuery = `
      SELECT COUNT(*) as count
      FROM stocksEsrow
      WHERE productordersid = ? AND stockid = ? AND brandid = ? AND batchnumber = ?
    `

    const result = await promisifyQuery(checkEscrowQuery, [productordersid, stockid, brandid, batchnumber])
    const orderCount = result[0].count

    return orderCount > 0
  }

  async serveApprovedReqt(data, approvedQty, requisitionid, departmentid) {
    try {
      if (!Array.isArray(data) || approvedQty < 0 || !requisitionid || !departmentid) {
        throw new Error("Invalid data provided")
      }

      const totalServed = data.reduce((acc, item) => acc + item.served, 0)
      if (totalServed !== approvedQty) {
        return "MISMATCH"
      }

      if (await this.checkStoreSuppliedAlready(requisitionid)) return "ALREADY SUPPLIED"

      const isUpdated = await this.updateDeptReqtAfterSupplied(1, requisitionid)

      if (isUpdated) {
        const filterData = data.filter((item) => item.served > 0)
        const results = await Promise.all(
          filterData.map(async (item, index) => {
            const { productordersid, stockid, brandid, batchnumber, served, type = "debit" } = item
            const outcome = await this.addProductEscrow(
              productordersid,
              stockid,
              brandid,
              batchnumber,
              served,
              type,
              requisitionid,
              departmentid
            )
            return rowAffected(outcome)
          })
        )

        const passedCount = results.filter((value) => value === true).length

        return passedCount === filterData.length ? "PASSED" : "FAILED"
      }
    } catch (err) {
      console.log(err)
      throw new Error(err)
    }
  }

  async updateRequisitionApproval(quantity, requisitionid, status) {
    if (!requisitionid || !status) throw new Error("requisitionid && status is required")
    const qty = parseInt(quantity)
    if (isNaN(requisitionid) || isNaN(qty)) throw new Error("valid integers required")

    if (qty < 0) return false
    const query = `UPDATE departmentrequisition SET quantity_approved = ?,status = ?, approvedOn = NOW() WHERE  id = ?`
    const result = await promisifyQuery(query, [quantity, status, requisitionid])
    return rowAffected(result)
  }

  async updateDeptReqtAfterSupplied(store_supplied, requisitionid) {
    if (!store_supplied || !requisitionid) throw new Error("Department id required")

    const mysql_query = `UPDATE departmentrequisition SET
                store_supplied = ?
                WHERE id = ?`

    const values = [store_supplied, parseInt(requisitionid)]

    return rowAffected(await promisifyQuery(mysql_query, values))
  }

  async updateQtyDeptReceived(quantityReceived, departmentReceived, status, employeeid, requisitionid) {
    const update_query = `UPDATE departmentrequisition 
       SET quantityReceived = ?, departmentReceived = ?, 
       status = ?, receivingemployee = ? WHERE id = ?`

    const values = [quantityReceived, departmentReceived, status, employeeid, requisitionid]

    return rowAffected(await promisifyQuery(update_query, values))
  }

  async updateReqtAfterReceivedDept(records) {
    console.log(records)
    const { quantityReceived, departmentReceived, id, status, employeeid, departmentid } = records

    if (!quantityReceived || !departmentReceived || !id || !employeeid || !departmentid) {
      throw new Error("quantityReceived, departmentReceived, requisitionid, departmentid status and employee id required")
    }

    let esrow = new Escrow(id)

    let esrowItems = await esrow.getEsrowReqt()

    if (esrowItems.length <= 0) return "NO ITEM IN ESCROW"

    function isToday(dateString) {
      const today = new Date()
      const itemDate = new Date(dateString)
      return (
        itemDate.getDate() === today.getDate() && itemDate.getMonth() === today.getMonth() && itemDate.getFullYear() === today.getFullYear()
      )
    }
    // check validity of esrow, must be pending and the addedon must be equal to today
    // Filter esrowItems based on the condition
    esrowItems = esrowItems.filter((item) => item?.status === "pending" && isToday(item?.addedon))
    // Check if there are any items left
    if (esrowItems.length === 0) {
      esrow.updateEscrow(id, "canceled")
      // delete requisition
      await database_queries.del(id, "departmentrequisition", "id")
      return "EXPIRED ESROW TIME, REQUEST AGAIN"
    }

    try {
      await promisifyQuery("START TRANSACTION")
      await this.updateQtyDeptReceived(quantityReceived, departmentReceived, status, employeeid, id)
      await esrow.updateEscrow(id, "received")
      await promisifyQuery("COMMIT")
      return "UPATED SUCCESSFULLY"
    } catch (error) {
      logger.error(error)
      await promisifyQuery("ROLLBACK")
    } finally {
      console.log("done")
    }
  }

  async getDepartmentBrandBatch(stockid,departmentid) {
    try {
      if (!stockid || !departmentid) {
        throw new Error("stockid and departmentid are required")
      }
      const queryString = `SELECT id,
      bt.batchnumber,
      bb.brand,
      bb.brandid,
      bt.departmentid,
      bt.quantity
      FROM departmentsmainsupply AS bt INNER JOIN stocksbrands AS bb ON bb.brandid = bt.brand
        WHERE bt.stockid = ?
        AND bt.departmentid = ?`
      const values = [stockid, departmentid]

      let result = await promisifyQuery(queryString, values)
      return result;
    } catch (err) {
      console.log(err)
      throw new Error(err);
    }
  }
}

module.exports = Departments
