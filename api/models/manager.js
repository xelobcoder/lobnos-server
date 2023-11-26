const { promisifyQuery, customError } = require("../../helper");
const logger = require("../../logger");
const connection = require("../db");
class Manager {
  constructor(employeeid, billingid, testid) {
    this.employeeid = employeeid;
    this.billingid = billingid;
    this.testid = testid;
  }

  getManagerApprovals = (duration) => {
    let defaultDuration = "daily";
  };

  verificationManager() {
    // we will check if manager exist in table in the database
    // if true , we continue else we return A 401 error 
    const sqlQuery = `SELECT * FROM roles WHERE employeeid = ? `;
    return new Promise((resolve, reject) => {
      connection.query(sqlQuery, [this.employeeid], function (err, result) {
        if (err) { reject(err.message) }
        else {
          result.length > 0 && result[0]['ROLE'] == ('Manager' || 'manager') ? resolve(true) : resolve(false)
        }
      })
    })
  }

  insertApproval = async (approvalStatus, message = null) => {
    let insertNewResult = `
    UPDATE test_ascension SET ApprovalStatus = ?,
    ApprovedBy = ? `;

    if (approvalStatus == false) {
      insertNewResult += `,DeclineMessage = '${message}' `
    }

    insertNewResult += `WHERE billingid = ? AND testid = ? `

    const values = [approvalStatus, this.employeeid, this.billingid, this.testid];

    let promise = new Promise((reject, resolve) => {
      connection.query(insertNewResult, values, (err, result) => {
        if (err) {
          reject(err);
        }
        if (result && result.affectedRows > 0) {
          resolve(result);
        }
      });
    });

    return promise;
  };

  getReadyForApprovals = async function (request, response) {
    const query = ` 
        SELECT ta.testid,
              ta.billingid,
              bb.clientstatus AS urgency,
              tt.NAME,
              ta.declineMessage,
              ta.approvedby,
              ta.approvalstatus,
              ta.actionPlan,
        CASE WHEN np.MIDDLENAME IS NULL THEN CONCAT(np.FIRSTNAME," ", np.LASTNAME) 
            WHEN np.MIDDLENAME IS NOT NULL THEN CONCAT(np.FIRSTNAME, " ", np.MIDDLENAME, " ", np.LASTNAME) 
            END AS fullname
        FROM test_ascension AS ta
            INNER JOIN billing as bb ON bb.BILLINGID = ta.billingid
            INNER JOIN new_patients AS np ON np.PATIENTID = bb.PATIENTID
            INNER JOIN test_panels AS tt ON tt.ID = ta.testid
        WHERE ta.ready = 'true'
        AND ta.ApprovalStatus = 0 and declineMessage is null
    `;

    try {
      let result = await promisifyQuery(query);
      if (result.length > 0) {
        result = result.sort((a, b) => a.urgency - b.urgency);
        response.send(result);
      }
    } catch (err) {
      logger.error(err.message);
      customError(err?.message, 500, response);
    }
  }

}




module.exports = Manager;