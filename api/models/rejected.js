const connection = require('../db')

// use case scenario

// query data via billingid to get information
// about the rejected client sample and personal information


const getSampleManagerValidation = async function (request, response, billingid) {
  const query = 'SELECT * FROM manager_sample_descision where BILLINGID = ?';

  connection.query(query, billingid, function (err, result) {
    if (err) {
      response.send({
        status: 'error',
        err
      })
    }
    if (result) {
      response.send({
        status: 'success',
        statusCode: 200,
        result
      })
    }
  })
}



const getSampleList = async function (billingid, response) {
  const query = `
  SELECT 
    tp.NAME AS testname,
    tp.CATEGORY AS category
    FROM samplestatus AS ss INNER JOIN test_panels AS tp
    ON ss.testid = tp.ID
 WHERE ss.BILLINGID = ${billingid} AND ss.approvalStatus = 0 AND ss.message IS NOT NULL
  `;
  connection.query(query, [billingid], function (err, result) {
    if (err) {
      response.send({
        status: 'error',
        err
      })
    } else {
      response.send({
        statusCode: 200,
        result,
        status: 'success'
      })
    }
  })
}


const updateSamplerRecord = async function (request, response) { }



const rejectedSample = async function (request, response) {
  const type = request.query.type;

  if (!type) {
    response.status(404).send({
      message: 'type required',
      statusCode: 404
    })
  }
  else {
    if (type === 'getsampleinfo') {
      const billingid = request.query.billingid;
      if (billingid) {
        let query = `
       SELECT np.AGE AS age,
          pt.BILLINGID AS bilingid,
          np.AGETYPE AS agetype,
          np.ACTIVATION_STATUS AS activationStatus,
          np.MOBILE_NUMBER AS mobileNumber,
          np.GENDER AS gender,
          np.EMAIL AS email,
          pt.URGENCY AS urgency,
          pt.SAMPLING_CENTER AS samplingCenter,
          np.MARITAL_STATUS AS maritalStatus,
          pt.INSPECTION_TIME AS inspectionTime,
          pt.PHELOBOTOMIST AS phelobotomist,
          pt.DATE AS 'date',
          CASE
            WHEN np.MIDDLENAME IS NULL THEN CONCAT(np.FIRSTNAME, " ", np.LASTNAME)
            ELSE CONCAT(
              np.FIRSTNAME,
              " ",
              np.MIDDLENAME,
              " ",
              np.LASTNAME
            )
          END AS fullname
        FROM new_patients AS np
          inner join performing_test AS pt ON np.PATIENTID = pt.PATIENTID
        WHERE pt.BILLINGID = ${billingid}
        `;
        // execute query
        connection.query(query, (err, result) => {
          if (err) {
            console.log(err)
            response.status(400).send({
              statusCode: 301,
              message: 'error occured'
            })
          }
          // send the response 
          else {
            response.status(200).send({
              statusCode: 200,
              message: 'success',
              result
            })
          }
        })
      }
      else {
        response.status(400).send({
          statusCode: 301,
          message: 'billingid is required'
        })
      }
    }
    else if (type === 'getvalidationstatus') {
      const billingid = request.query.billingid;
      if (billingid) {
        getSampleManagerValidation(request, response, billingid)
      } else {
        response.status(404).send({
          message: 'include',
          statusCode: 404
        })
      }
    }
    else if (type == 'getRejectedClientSample') {
      const billingid = request.query.billingid;
      getSampleList(billingid, response)
    }
    else {
      response.status(404).send({
        message: 'type not recognized',
        statusCode: 404
      })
    }
  }
}




const RejectedSampleApproval = async function (request, response) {
  const { action, billingid, manager, message } = request.body;

  const query = `INSERT INTO manager_sample_descision (BILLINGID,ACTION,MESSAGE,MANAGER) VALUES (?,?,?,?)`
  connection.query(query, [billingid, action, message, manager], function (err, result) {
    if (err) {
      response.send({
        status: 'error',
        err
      })
    }
    if (result) {
      response.send({
        status: 'success',
        message: 'updated',
        statusCode: 200
      })
    }
  })
}



module.exports = {
  rejectedSample,
  RejectedSampleApproval
}