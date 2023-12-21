const logger = require('../logger');
const connection = require('./db')

const activation = {
  // get partial data of patients

  /**
   * 
   * @param {request} request  http request object which the request query
   * @param {response} response  http response object 
   */
  getPartialData: function (request, response) {
    //  get first top 20 data if the request quetry object is empty
    if (Object.keys(request.query).length == 0) {
      const activationQuery = ` SELECT ID, PATIENTID,
        CASE 
          WHEN MIDDLENAME IS NULL THEN CONCAT(FIRSTNAME, ' ', LASTNAME)
          ELSE CONCAT(FIRSTNAME, ' ', MIDDLENAME, ' ', LASTNAME)
        END AS FULLNAME,
        DATE, 
        ACTIVATION_STATUS
        FROM new_patients ORDER BY ID DESC LIMIT 10
        `

      connection.query(activationQuery, (err, result) => {
        if (err) {
          logger.error(err);
        }
        if (result) {
          response.send(result);
        }
      });
    } else {
      const { fullname, patientid, mobile, to, from } = request.query;


      let activationQuery = `
        SELECT ID, PATIENTID,
        CASE 
          WHEN MIDDLENAME IS NULL THEN CONCAT(FIRSTNAME, ' ', LASTNAME)
          ELSE CONCAT(FIRSTNAME, ' ', MIDDLENAME, ' ', LASTNAME)
        END AS FULLNAME,
        DATE, 
        ACTIVATION_STATUS
        FROM new_patients
    `
      if (patientid) {
        activationQuery += ` WHERE PATIENTID =  ${patientid}`
      }


      if (!patientid && fullname) {
        activationQuery += ` WHERE FIRSTNAME LIKE '%${fullname}' OR MIDDLENAME LIKE '%${fullname}' OR LASTNAME LIKE '%${fullname}'`
      } else if (fullname && patientid) {
        activationQuery += ` AND FIRSTNAME LIKE '%${fullname}' OR MIDDLENAME LIKE '%${fullname}' OR LASTNAME LIKE '%${fullname}'`
      } else {
        activationQuery = activationQuery
      }


      if (mobile) {
        if (!patientid && !fullname && mobile) {
          activationQuery += ` WHERE MOBILE_NUMBER =${mobile}`
        } else {
          activationQuery += ` AND MOBILE_NUMBER = ${mobile}`
        }
      } else {
        activationQuery = activationQuery
      }

      if (patientid || fullname || mobile) {
        if (from) {
          activationQuery += ` AND DATE BETWEEN '${from}'`
        }

        if (to) {
          activationQuery += ` AND ${to}`
        } else {
          activationQuery += ` AND CURRENT_DATE`
        }
      } else {
        if (from) {
          activationQuery += ` WHERE DATE BETWEEN '${from}'`
        } else {
          activationQuery += ` WHERE DATE BETWEEN CURRENT_DATE `
        }
        if (to) {
          activationQuery += `  AND '${to}'`
        } else {
          activationQuery += ` AND CURRENT_DATE `
        }

      }

      activationQuery += ` ORDER BY ID DESC
        LIMIT 10`

      console.log(activationQuery)
      connection.query(activationQuery, (err, result) => {
        if (err) {
          logger.error(err);
        }
        if (result) {
          console.log(result)
          response.send(result);
        }
      });
    }
  },


  activateDeactivate: function (request, response) {
    const { patientid, action } = request.query;

    if (!action) {
      response.send({
        message: 'action required',
        status: 'error',
        statusCode: 401
      })
    }
    else {
      let queryString = `UPDATE new_patients SET ACTIVATION_STATUS = ?`
      if (patientid) {
        queryString += ` WHERE PATIENTID = ?`
      }

      connection.query(
        queryString,
        [action, patientid],
        (err, result) => {
          if (err) {
            response.status(404).send({
              statusCode: 404,
              message: err.message,
            });
          }
          response.send({
            message: "success",
            action: action === "TRUE" ? "BILLING" : "ACTIVATION PAGE",
          });
        }
      );
    }

  },
};


module.exports = activation


// activation.getPartialData({ mobile: '030300303', fullname: 'tiifu', patientid: 939393, to: 93939, from: 93939 }, {})