const connection = require('./db')
const SUCCESSMESSAGE = 'SUCCESS'
const ERRORMESSAGE = 'FAILED'
const ADD_PATIENT_QUERY = `INSERT INTO NEW_PATIENTS (
    FIRSTNAME,
    LASTNAME,
    MIDDLENAME,
    AREA,
    REGION,
    ADDRESS,
    EMAIL,
    PATIENTID,
    AGE,
    AGETYPE,
    MARITAL_STATUS,
    RELATIONSHIP,
    EMMERGENCY_CONTACT_NAME,
    EMMERGENCY_CONTACT,
    GENDER,
    DOB,
    MOBILE_NUMBER,
    OCCUPATION,
    PATIENTORGANIZATION
) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`

// Step: 1 - check if patient is already registered as a patient
// Step: 2 - if not registered, add patient to database
//  progress
// 1. return message to go to billing page
// 2. client is automatically activated to start billing
// 3. client is added to operational list
// 4. test is listed in performing test table with id linked to operational list
// Step: 3 - if registered, return error message of patient already registered
// Step: 4 - if patient is added, return success message
// step: 5

// step 1

// this function checks for the present of the patient in the database
/**
 *
 * @param {Number} patientid patientid
 * @returns {promise} promise returns a promise of true,false or error
 */
var checkpatient = function (patientid) {
  const CHECK_PATIENT_QUERY = `SELECT * FROM NEW_PATIENTS WHERE PATIENTID = ?`

  return new Promise((resolve, reject) => {
    // query db for patientid
    connection.query(CHECK_PATIENT_QUERY, [patientid], (err, result) => {
      if (err) {
        reject(err)
      }
      if (result) {
        result.length > 0 ? resolve(true) : resolve(false)
      }
    })
  })
}

// step 2

var addpatient = function (request, response) {
  const {
    firstname,
    lastname,
    middlename,
    email,
    patientid,
    age,
    ageType,
    maritalstatus,
    relationship,
    emmergencyName,
    emmergencyContactNumber,
    mobile,
    gender,
    days,
    months,
    area,
    region,
    address,
    years,
    occupation,
    patientOrganization,
  } = request.body



  var dob = new Date(parseInt(years), parseInt(months - 1), parseInt(days))

  const data = [
    firstname,
    lastname,
    middlename,
    area,
    region,
    address,
    email,
    patientid,
    age,
    ageType,
    maritalstatus,
    relationship,
    emmergencyName,
    emmergencyContactNumber,
    gender,
    dob,
    mobile,
    occupation,
    patientOrganization,
  ]

  checkpatient(request.body?.patientid)
    .then((result) => {
      if (result == true) {
        response.send({
          status: ERRORMESSAGE,
          message: 'Patient already registered',
          patientid,
          statusCode: 401
        })
      }

      if (!result) {
        connection.query(ADD_PATIENT_QUERY, data, (err, result) => {
          if (err) throw err
          response.send({
            status: SUCCESSMESSAGE,
            message: 'Patient successfully registered',
            patientid,
            statusCode: 200
          })
        })
      }
    })
    .catch((err) => {
      throw err
    })
}

const getpatient = function (request, response) {
  const queryLength = Object.keys(request.query).length;
  const isPatientid = Object.keys(request.query).includes('patientid');
  const isFilter = Object.keys(request.query).includes('filter');
  const isFullname = Object.keys(request.query).includes('fullname');
  const isPhoneNumber = Object.keys(request.query).includes('phonenumber');
  const isdateIncluded = Object.keys(request.query).includes('date_from')
  // if request query is greater than 0
  if (queryLength > 0) {
    if (isPatientid) {
      connection.query(
        'SELECT * FROM NEW_PATIENTS WHERE PATIENTID = ?',
        [request.query.patientid],
        (err, result) => {
          if (err) throw err
          response.send(result)
        },
      )
    }


    if (isFullname) {
      connection.query(`SELECT * FROM NEW_PATIENTS WHERE FIRSTNAME LIKE ? `,
        [request.query.fullname],
        (err, result) => {
          if (err) throw err;
          response.send(result)
        })
    }


    if (isPhoneNumber) {
      connection.query(`SELECT * FROM NEW_PATIENTS WHERE MOBILE_NUMBER = ?`,
        [request.query.phonenumber],
        (err, result) => {
          if (err) throw err;
          response.send(result)
        })
    }

    if (
      isFilter & !isdateIncluded
    ) {
      const { filter } = request.query
      //  Filter fullname or patient id
      connection.query(
        'SELECT * FROM NEW_PATIENTS WHERE FULLNAME LIKE ? OR PATIENTID LIKE ?',
        ['%' + filter + '%', '%' + filter + '%'],
        (err, result) => {
          if (err) {
            throw err
          }
          response.send(result)
        },
      )
    }
    // if contains filter value , date from and date to

    if (
      isFilter && isdateIncluded
    ) {
      const { filter } = request.query
      const { date_from } = request.query || new Date()
      const { date_to } = request.query || new Date()
      connection.query(
        'SELECT * FROM NEW_PATIENTS WHERE FULLNAME LIKE ? OR PATIENTID LIKE ? AND DATE BETWEEN ? AND ?',
        ['%' + filter + '%', '%' + filter + '%', date_from, date_to],
        (err, result) => {
          if (err) {
            throw err
          }
          response.send(result)
        }
      )
    }
  } else {
    // send all first 500 patients
    connection.query('SELECT * FROM NEW_PATIENTS LIMIT 1000', (err, result) => {
      if (err) {
        throw err
      }
      response.send(result)
    })
  }
}


const putpatient = async function (request, response) {
  const {
    firstname,
    lastname,
    middlename,
    email,
    patientid,
    age,
    ageType,
    maritalstatus,
    relationship,
    emmergencyName,
    emmergencyContactNumber,
    mobile,
    gender,
    days,
    months,
    area,
    region,
    address,
    years,
    occupation,
    patientOrganization,
  } = request.body




  const data = [
    firstname,
    lastname,
    middlename,
    area,
    region,
    address,
    email,
    age,
    ageType,
    maritalstatus,
    relationship,
    emmergencyName,
    emmergencyContactNumber,
    gender,
    mobile,
    occupation,
    patientOrganization,
    patientid,
  ]



  //  we gonna update the patient
  // first we check if the patient exist
  const patientExist = await checkpatient(request.body?.patientid)
  if (patientExist) {
    // update query beloe

    const mysqlQuery = `UPDATE NEW_PATIENTS SET FIRSTNAME = ?, LASTNAME = ?, MIDDLENAME = ?, AREA = ?, REGION = ?, ADDRESS = ?, EMAIL = ?, AGE = ?, AGETYPE = ?, MARITAL_STATUS = ?, RELATIONSHIP = ?,
     EMMERGENCY_CONTACT_NAME = ?, EMMERGENCY_CONTACT = ?, 
    GENDER = ?, MOBILE_NUMBER = ?, OCCUPATION = ?, PATIENTORGANIZATION = ? WHERE PATIENTID = ?`;


    // execute the query

    connection.query(mysqlQuery, data, (err, result) => {
      console.log(err)
      if (err) {
        response.send({
          status: ERRORMESSAGE,
          message: 'Patient update failed',
          patientid,
          statusCode: 401
        })
      }
      else {
        response.send({
          status: SUCCESSMESSAGE,
          message: 'Patient successfully updated',
          patientid,
          statusCode: 200
        })
      }
    })

  } else {
    response.send({
      status: ERRORMESSAGE,
      message: 'Patient does not exist',
      patientid,
      statusCode: 401
    })
  }

}


module.exports = {
  addpatient,
  getpatient,
  putpatient,
  checkpatient
}