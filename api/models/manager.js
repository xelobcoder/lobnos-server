const connection = require("../db");
const { testTable } = require("./result");
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
    UPDATE TEST_ASCENSION SET ApprovalStatus = ?,
    ApprovedBy = ? `;

    if (approvalStatus == false) {
      insertNewResult += `,DeclineMessage = '${message}' `
    }

    insertNewResult += `WHERE BILLINGID = ? AND TESTID = ? `

    const values = [approvalStatus, this.employeeid, this.billingid, this.testid];

    let promise = new Promise((reject, resolve) => {
      connection.query(insertNewResult, values, (err, result) => {
        if (err) {
          reject(err);
        }
        if (result && result.affectedRows > 0) {
          reject(result);
        }
      });
    });

    return promise;
  };

  getReadyForApprovals = function (request, response) {
    const query = ` 
        SELECT ta.testid,
              ta.billingid,
              pt.URGENCY,
              tt.NAME,
              ta.declineMessage,
              ta.actionPlan,
        CASE WHEN np.MIDDLENAME IS NULL THEN CONCAT(np.FIRSTNAME," ", np.LASTNAME) 
            WHEN np.MIDDLENAME IS NOT NULL THEN CONCAT(np.FIRSTNAME, " ", np.MIDDLENAME, " ", np.LASTNAME) 
            END AS fullname
        FROM test_ascension AS ta
            INNER JOIN billing as bb ON bb.BILLINGID = ta.billingid
            INNER JOIN performing_test as pt ON pt.BILLINGID = bb.BILLINGID
            INNER JOIN new_patients AS np ON np.PATIENTID = bb.PATIENTID
            INNER JOIN test_panels AS tt ON tt.ID = ta.testid
        WHERE ta.ready = 'true'
        AND ta.ApprovalStatus = 0
    `
    connection.query(query, function (err, result) {
      if (err) {
        throw err;
      }
      response.send(result);
    })
  }

}




module.exports = Manager;