const { customError, promisifyQuery } = require("../../helper");
const logger = require("../../logger");
const connection = require("../db");

class Payment {
  constructor(patientid) {
    this.patientid = patientid;
  }

  getClientTransactionInformation = async (request, response) => {
    try {
      const { patientid, month, date, count } = request.query;

      const months = {
        january: "1",
        february: "2",
        march: "3",
        april: "4",
        may: "5",
        june: "6",
        july: "7",
        august: "8",
        september: "9",
        october: "10",
        november: "11",
        december: "12",
      };
  
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
          DATE(pt.DATE) as date
        FROM new_patients AS np
        INNER JOIN performing_test as pt ON pt.PATIENTID = np.PATIENTID
        INNER JOIN billing as b ON b.BILLINGID = pt.BILLINGID
      `;
  
      if (patientid) {
        modelQuery += ` WHERE np.PATIENTID = ${patientid}`;
      }
  
      if (month && patientid) {
        modelQuery += ` AND MONTH(pt.DATE) = ${months[month]}`;
      } else if (month) {
        modelQuery += ` WHERE MONTH(pt.DATE) = ${months[month]}`;
      } else {
        modelQuery = modelQuery;
      }
  
      if (date && !patientid && !month) {
        modelQuery += ` WHERE DATE(pt.DATE) = '${date}'`;
      } else if ((date && patientid) || (date && month)) {
        modelQuery += ` AND DATE(pt.DATE) = '${date}'`;
      } else {
        modelQuery = modelQuery;
      }
  
      if (count) {
        modelQuery += `
        ORDER BY b.BILLINGID DESC
        LIMIT ${count}
      `;
      } else {
        modelQuery += `
        ORDER BY b.BILLINGID DESC
        LIMIT 10
      `;
      }
      const result = await promisifyQuery(modelQuery);
      response.send({ result, statusCode: 200, status: "success"});
    } catch (err) {
      logger.error(err);
      customError("something went wrong", 500, response);
    }
  };


  getClientFullOutstanding = async (patientid, billingid) => {
    if (!billingid || !patientid) {
      return `patientid && billing required`
    }
    else {
      let modelQuery = `SELECT SUM(PAID_AMOUNT) AS paid,SUM(PAYABLE) AS total FROM billing WHERE PATIENTID = ? `;
      let result = await promisifyQuery(modelQuery, [patientid]);
      if (result.length > 0) {
        const { total, paid } = result[0];
        const outstanding = total - paid;
        return outstanding === 0 ? 0 : outstanding;
      }
    }
  }

  getTransactionData = async function (billingid) {
    if (!billingid) {
      return `billingid is required`;
    }
    else {
      let modelQuery = `SELECT * FROM billing AS b INNER JOIN new_patients AS np ON
      b.patientid = np.patientid WHERE billingid = ? `;
      return promisifyQuery(modelQuery, [billingid]);
    }
  }

  allClientDebtTransactions = async (patientid) => {
    if (!patientid) {
      return `billingid is required`;
    } else {
      let modelQuery = `SELECT pt.date,b.billingid,b.outstanding,b.paid_amount AS paid,b.payable,b.discount
        FROM billing AS b
          INNER JOIN performing_test AS pt ON pt.billingid = b.billingid
        WHERE b.patientid = ?
          AND b.OUTSTANDING > 0`;
      return promisifyQuery(modelQuery, [parseInt(patientid)])
    }
  }

  updateSingleTransactionDebt = async (billingid, paid, outstanding) => {
    const model = `UPDATE billing SET  PAID_AMOUNT = ?,OUTSTANDING = ? WHERE BILLINGID = ?`;
    try {
      return promisifyQuery(model, [paid, outstanding, billingid]);
    } catch (err) {
      return err;
    }
  }


  updateTransactionHx = async (billingid, payment, amount) => {
    const model = `INSERT INTO billingHx (BILLINGID,paymentmode,amount) VALUES (?,?,?)`;
    return promisifyQuery(model, [billingid, payment, amount]);
  }

  clearClientDebtBulk = async (patientid, amount) => {
    if (!patientid) {
      return `billingid is required`;
    } else {
      let debts = await this.allClientDebtTransactions(patientid);
      // updating single transaction one by one
      let target = debts.length;
      let current = 0;
      let balance = amount;
      while (current < target && balance != 0) {
        const { outstanding, paid, payable, discount, billingid } = debts[0];
        if (balance > outstanding) {
          // update single
          // subtract outstanding from balance 
          // compare balance with the next outstanding 
          // break loop if outstanding is greater than the balance 
          await this.updateSingleTransactionDebt(billingid, payable, 0);
          await this.updateTransactionHx(billingid, 4, outstanding);
          balance = balance - outstanding;
          current++;
        }

        if ((balance < outstanding) && balance > 0) {
          // new outstanding;
          const paidAmout = parseInt(paid) + balance;
          const nwOutstanding = parseInt(payable) - (parseInt(discount) + parseInt(paid) + parseInt(balance))
          await this.updateSingleTransactionDebt(billingid, paidAmout, nwOutstanding)
          await this.updateTransactionHx(billingid, 4, balance);
          balance = 0;
          current++;
        }
        if (balance == 0) {
          break;
        }
      }
    }
  }
  updatePayment = async (request, response) => {
    // get the current billing billinfo
    // update the record and update the database
    const { billingid, outstanding, pay, paymentMode } = request.body;
    const getQuery = `SELECT * FROM BILLING WHERE BILLINGID = ${billingid}`
    connection.query(getQuery, function (err, result) {
      if (err) { logger.error(err); }
      if (result) {
        if (result.length > 0) {
          const previousPayment = result[0]["PAID_AMOUNT"];
          const discount = result[0]["DISCOUNT"];
          const oldstanding = result[0]["OUTSTANDING"];
          if (oldstanding <= 0) {
            response.send({ status: "success", statusCode: 200, message: "Client is in good standing", });
          } else {
            const newAmount = previousPayment + parseInt(pay);
            const nOutstanding = result[0]["PAYABLE"] - newAmount - discount;
            const updateQuery = `UPDATE BILLING 
							SET OUTSTANDING = ?,
							PAID_AMOUNT = ?
							WHERE BILLINGID = ?
							`;
            const values = [nOutstanding, newAmount, billingid];
            connection.query(updateQuery, values, function (err, result) {
              if (err) { logger.error(err); } else {
                // update paymentHx to have a transaction hx of the client in terms of that billingid
                const { affectedRows } = result;
                if (affectedRows == 1) {
                  const updateHxQuery = `INSERT INTO billingHx (BILLINGID,paymentmode,amount) VALUES (?,?,?)`;
                  connection.query(
                    updateHxQuery,
                    [billingid, paymentMode, pay],
                    (err, result) => {
                      if (err) {
                        logger.error(err);
                      } else {
                        response.send({
                          message: "Payment update successfully",
                          status: "success",
                          statusCode: 200,
                        });
                      }
                    }
                  );
                }
              }
            });
          }
        }
      }
    }
    );
  };
  paymentMode = async (request, response) => {
    try {
      const result = await promisifyQuery(`SELECT * FROM paymentmodes`);
      response.send({ data: result || [], status: "success", statusCode: 200});
    } catch (err) {
      customError("somthing went wrong", 500, response);
   }
  };

  specificBillTransactionHx = async (request, response) => {
    try {
      const { billingid } = request.query;
      if (!billingid) { customError('billingid is required as a query', 401, response); return; }
      const result = await promisifyQuery(`SELECT * FROM billingHx WHERE BILLINGID = ?  ORDER BY KeyID DESC`,[billingid]);
      response.send(result);
    } catch (err) {
      customError("somthing went wrong", 500, response);
   }
  };
}

module.exports = Payment;