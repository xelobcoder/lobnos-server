const { response } = require("express")
const { customError, promisifyQuery, paginationQuery, rowAffected, responseError } = require("../../helper")
const logger = require("../../logger")
const connection = require("../db")

class Payment {
  constructor(patientid) {
    this.patientid = patientid
  }

  getClientTransactionInformation = async (records, response) => {
    try {
      const { patientid, from, to, count = 10, page = 1 } = records
      const values = []

      let modelQuery = `
        SELECT 
          np.PATIENTID AS patientid,
          CONCAT(np.FIRSTNAME,' ',np.MIDDLENAME,' ',np.LASTNAME) AS fullname,
          np.EMAIL AS email,
          CONCAT(0,np.MOBILE_NUMBER) AS mobileNumber,
          b.BILLINGID AS billingid,
          b.OUTSTANDING AS outstanding,
          b.DISCOUNT AS discount,
          b.PAID_AMOUNT AS paid_amount,
          b.PAYABLE AS payable,
          DATE(b.billedon) as date
        FROM new_patients AS np
        INNER JOIN billing as b ON np.patientid = b.patientid
      `

      if (patientid) {
        modelQuery += ` WHERE np.PATIENTID = ?`
        values.push(parseInt(patientid))
      }

      if (from && patientid) {
        values.push(from)
        if (to) {
          modelQuery += ` AND DATE(b.billedon) BETWEEN ? AND ?`
          values.push(to)
        } else {
          modelQuery += ` AND DATE(b.billedon) BETWEEN ? AND CURRENT_DATE`
        }
      } else if (!patientid && from) {
        values.push(from)
        if (!to) {
          modelQuery += ` WHERE DATE(b.billedon) BETWEEN ? AND CURRENT_DATE`
        } else {
          modelQuery += ` WHERE DATE(b.billedon) BETWEEN ? AND ?`
          values.push(to)
        }
      } else {
        modelQuery = modelQuery
      }

      modelQuery += ` ORDER BY b.billingid DESC LIMIT ? OFFSET ? `

      const result = await paginationQuery({ count, page }, modelQuery, values)

      return result
    } catch (err) {
      logger.error(err)
      throw new Error(err)
    }
  }

  getClientFullOutstanding = async (patientid, billingid) => {
    if (!billingid || !patientid) {
      return `patientid && billing required`
    } else {
      let modelQuery = `SELECT SUM(PAID_AMOUNT) AS paid,SUM(PAYABLE) AS total FROM billing WHERE PATIENTID = ? `
      let result = await promisifyQuery(modelQuery, [patientid])
      if (result.length > 0) {
        const { total, paid } = result[0]
        const outstanding = total - paid
        return outstanding
      }
    }
  }

  getTransactionData = async function (patientid) {
    if (!patientid) {
      throw new Error("patientid not included")
    } else {
      let modelQuery = `SELECT * FROM billing AS b INNER JOIN new_patients AS np ON
      b.patientid = np.patientid WHERE np.patientid = ? `
      return promisifyQuery(modelQuery, [patientid])
    }
  }

  allClientDebtTransactions = async (patientid) => {
    if (!patientid) {
      return `billingid is required`
    } else {
      let modelQuery = `SELECT 
      billedon AS date,
      billingid,
      outstanding,
      paid_amount AS paid,
      payable,
      discount
      FROM billing 
      WHERE patientid = ?
      AND outstanding > 0`
      return promisifyQuery(modelQuery, [parseInt(patientid)])
    }
  }

  updateSingleTransactionDebt = async (billingid, paid, outstanding) => {
    const model = `UPDATE billing SET  PAID_AMOUNT = ?,OUTSTANDING = ? WHERE BILLINGID = ?`
    try {
      return promisifyQuery(model, [paid, outstanding, billingid])
    } catch (err) {
      return err
    }
  }

  updateTransactionHx = async (billingid, payment, amount, employeeid) => {
    const model = `INSERT INTO billingHx (BILLINGID,paymentmode,amount,employeeid) VALUES (?,?,?,?)`
    return promisifyQuery(model, [billingid, payment, amount, employeeid])
  }

  clearClientDebtBulk = async (patientid, amount, pymode, employeeid) => {
    try {
      if (!patientid) {
        return `billingid is required`
      } else {
        let debts = await this.allClientDebtTransactions(patientid)

        if (debts.length === 0) return "No Exist"

        const totalDebt = debts.reduce((a, b) => {
          return a + b.outstanding
        }, 0)

        if (totalDebt === amount) {
          const result = await Promise.all(
            debts.map(async (item, index) => {
              const { outstanding, paid, payable, discount, billingid } = item
              const dd = rowAffected(await this.updateSingleTransactionDebt(billingid, payable, 0))
              const tt = rowAffected(await this.updateTransactionHx(billingid, pymode, outstanding, employeeid))
              return dd && tt
            })
          )
          return result.some((a, b) => a == false) ? false : true;
        } else {
          // // updating single transaction one by one
          let target = debts.length
          let current = 0
          let balance = amount
          while (current <= target && balance > 0) {
            const { outstanding, paid, payable, discount, billingid } = debts[current]
            if (balance >= outstanding) {
              // update single
              // subtract outstanding from balance
              // compare balance with the next outstanding
              // break loop if outstanding is greater than the balance
              await this.updateSingleTransactionDebt(billingid, payable, 0)
              await this.updateTransactionHx(billingid, pymode, outstanding, employeeid)
              balance = balance - outstanding
              console.log(balance, "te")
              current++
            } else {
              // new outstanding;
              const paidAmout = parseInt(paid) + balance
              const nwOutstanding = parseInt(payable) - (parseInt(discount) + parseInt(paid) + parseInt(balance))
              await this.updateSingleTransactionDebt(billingid, paidAmout, nwOutstanding, employeeid)
              await this.updateTransactionHx(billingid, pymode, balance, employeeid)
              console.log(balance, "t")
              balance = 0
              current++
            }
          }
          return balance === 0 ? true : false
        }
      }
    } catch (err) {
      responseError(response)
    }
  }
  updatePayment = async (request, response) => {
    // get the current billing billinfo
    // update the record and update the database
    const { billingid, outstanding, pay, paymentMode } = request.body
    const getQuery = `SELECT * FROM BILLING WHERE BILLINGID = ${billingid}`
    connection.query(getQuery, function (err, result) {
      if (err) {
        logger.error(err)
      }
      if (result) {
        if (result.length > 0) {
          const previousPayment = result[0]["PAID_AMOUNT"]
          const discount = result[0]["DISCOUNT"]
          const oldstanding = result[0]["OUTSTANDING"]
          if (oldstanding <= 0) {
            response.send({ status: "success", statusCode: 200, message: "Client is in good standing" })
          } else {
            const newAmount = previousPayment + parseInt(pay)
            const nOutstanding = result[0]["PAYABLE"] - newAmount - discount
            const updateQuery = `UPDATE BILLING 
							SET OUTSTANDING = ?,
							PAID_AMOUNT = ?
							WHERE BILLINGID = ?
							`
            const values = [nOutstanding, newAmount, billingid]
            connection.query(updateQuery, values, function (err, result) {
              if (err) {
                logger.error(err)
              } else {
                // update paymentHx to have a transaction hx of the client in terms of that billingid
                const { affectedRows } = result
                if (affectedRows == 1) {
                  const updateHxQuery = `INSERT INTO billingHx (BILLINGID,paymentmode,amount) VALUES (?,?,?)`
                  connection.query(updateHxQuery, [billingid, paymentMode, pay], (err, result) => {
                    if (err) {
                      logger.error(err)
                    } else {
                      response.send({
                        message: "Payment update successfully",
                        status: "success",
                        statusCode: 200,
                      })
                    }
                  })
                }
              }
            })
          }
        }
      }
    })
  }
  paymentMode = async (request, response) => {
    try {
      const result = await promisifyQuery(`SELECT * FROM paymentmodes`)
      response.send({ data: result || [], status: "success", statusCode: 200 })
    } catch (err) {
      customError("somthing went wrong", 500, response)
    }
  }

  specificBillTransactionHx = async (request, response) => {
    try {
      const { billingid } = request.query
      if (!billingid) {
        customError("billingid is required as a query", 401, response)
        return
      }
      const result = await promisifyQuery(`SELECT * FROM billingHx WHERE BILLINGID = ?  ORDER BY KeyID DESC`, [billingid])
      response.send(result)
    } catch (err) {
      customError("somthing went wrong", 500, response)
    }
  }
}

module.exports = Payment
