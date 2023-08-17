const connection = require('./db');
const { database_queries } = require("./testResult");
// YET TO BE CODED
// AFTER CHANGE OF STATUS CLIENT WOULD BE NOTIFIED VIA EMAIL
// OF SAMPLE STATUS CHANGE AND NECESSARY ACTION TO BE AND RECOMMEDATION TAKEN

class SampleHandler {
  constructor(status, date, request, response) {
    this.status = status;
    this.date = date;
    this.response = response;
    this.request = request;
  }

  getStatus(status) {
    if (status != "") {
      let SQL_QUERY = `
      SELECT DISTINCT
      p.PATIENTID,
      p.BILLINGID,
     CASE WHEN np.MIDDLENAME IS NULL OR np.MIDDLENAME = ''
          THEN CONCAT(np.FIRSTNAME, ' ', np.LASTNAME)
          ELSE CONCAT(np.FIRSTNAME, ' ', np.LASTNAME, ' ', np.MIDDLENAME)
    END AS FULLNAME,
      p.DATE,
      p.ID
     FROM PERFORMING_TEST as p
      join billing as b ON p.PATIENTID = b.PATIENTID
      inner join test_ascension AS ta ON ta.billingid = b.BILLINGID
      join new_patients as np ON p.PATIENTID = np.PATIENTID
      WHERE ta.ApprovalStatus = 0 AND declineMessage IS  NULL
      GROUP BY b.BILLINGID
      ORDER BY p.DATE DESC LIMIT 20     
      `;
      connection.query(SQL_QUERY, (err, result) => {
        if (err) {
          throw err;
        }
        this.response.send(result);
      });
    }
  }
  getDates(date) {
    let SQL_QUERY = `
    SELECT DISTINCT p.SAMPLE_STATUS,
      p.PATIENTID,
      p.BILLINGID,
      CASE WHEN np.MIDDLENAME IS NULL OR np.MIDDLENAME = ''
                      THEN CONCAT(np.FIRSTNAME, ' ', np.LASTNAME)
                      ELSE CONCAT(np.FIRSTNAME, ' ', np.LASTNAME, ' ', np.MIDDLENAME)
                END AS FULLNAME,
      p.DATE,
      p.MESSAGE,
      p.ID
     FROM PERFORMING_TEST as p
      join billing as b ON p.PATIENTID = b.PATIENTID
      join new_patients as np ON p.PATIENTID = np.PATIENTID
     WHERE p.DATE= ${date} ORDER BY p.BILLINGID DESC LIMIT 100    
    `;
    connection.query(SQL_QUERY, (err, result) => {
      if (err) {
        throw err;
      }
      this.response.send(result);
    });
  }
  getSelectedStutusAndDate(date, status) {
    if (date && status) {
      let SQL_QUERY = `
            SELECT DISTINCT p.SAMPLE_STATUS,
                p.PATIENTID,
                p.BILLINGID,
                p.MESSAGE,
                CASE WHEN np.MIDDLENAME IS NULL OR np.MIDDLENAME = ''
                      THEN CONCAT(np.FIRSTNAME, ' ', np.LASTNAME)
                      ELSE CONCAT(np.FIRSTNAME, ' ', np.LASTNAME, ' ', np.MIDDLENAME)
                END AS FULLNAME,
                p.DATE,
                p.ID
          FROM PERFORMING_TEST AS p
          JOIN billing AS b ON p.PATIENTID = b.PATIENTID
          JOIN new_patients AS np ON p.PATIENTID = np.PATIENTID
          WHERE p.DATE = '${date}' AND p.SAMPLE_STATUS = '${status}'
          ORDER BY p.BILLINGID DESC
          LIMIT 50
    `;
      connection.query(SQL_QUERY, (err, result) => {
        if (err) {
          throw err;
        }
        this.response.send(result);
      });
    }
  }
  getRecords() {
    let SQL_QUERY = `
      SELECT 
        CASE
          WHEN np.MIDDLENAME IS NULL THEN CONCAT(np.FIRSTNAME, ' ', np.LASTNAME)
          ELSE CONCAT(np.FIRSTNAME, ' ', np.MIDDLENAME, ' ', np.LASTNAME)
        END AS 'FULLNAME',
        ss.billingid AS 'BILLINGID',
        pt.DATE AS 'DATE',
        ( SELECT COUNT(billingid) FROM samplestatus WHERE approvalstatus = 0 
      AND billingid = pt.billingid) AS 'PENDINGCOUNT'
      FROM samplestatus as ss
      INNER JOIN performing_test as pt ON pt.BILLINGID = ss.billingid
      INNER JOIN new_patients as np ON np.PATIENTID = pt.PATIENTID
      GROUP BY ss.billingid
    ORDER BY pt.DATE DESC LIMIT 30
  `;
    connection.query(SQL_QUERY, (err, result) => {
      if (err) {
        throw err;
      }
      else {
        // check for pending  count in item of the result and only send those ABOVE 0
        let filteredResult = result.filter(item => item.PENDINGCOUNT > 0);
        this.response.send(filteredResult);
      }
    });
  }
  updateRecords(request, response) {
    const { billingid, testid, action, message } = request.body;

    let approvalStatus = action == 'reject' ? 0 : 1;

    let SQL_QUERY = `
    UPDATE samplestatus SET
     approvalstatus = ${approvalStatus}
     `

    if (action == 'reject') {
      SQL_QUERY += `, message = '${message}'`
    }

    SQL_QUERY += ` WHERE billingid = ${billingid} AND testid = ${testid}`

    console.log(SQL_QUERY)
    connection.query(SQL_QUERY, (err, result) => {
      if (err) {
        throw err;
      }
      else {
        response.send({
          statusCode: 200,
          status: 'success',
          message: 'record updated successfully'
        })
      }
    })
  }
}



module.exports = SampleHandler;
