const { response } = require('express');
const { customError } = require('../../helper');
const connection = require('../db');
const logger = require('../../logger');


/**
 * The `Registration` class is responsible for handling the registration of new patients in a healthcare system.
 * It provides methods for checking if bulk registration is enabled, generating a unique patient ID, checking if a patient ID already exists,
 * checking if an email or mobile number already exists, adding personal information of a patient, adding addressing information of a patient,
 * adding emergency contact information of a patient, and updating personal information of a patient.
 *
 * @class Registration
 */
class Registration {
  constructor(patientid) {
    this.patientid = patientid;
  }

  isBulkRegistration = async function () {
    return new Promise((resolve, reject) => {
      const query = `SELECT  bulkregistration FROM applicationsettings`;
      //  connecting to database 
      connection.query(query, function (err, result) {
        if (err) {
          reject(err)
        } else {
          if (result.length == 0) {
            resolve(false)
          } else {
            const bulkregistration = result[0]['bulkregistration'];
            if (bulkregistration == 0) {
              resolve(false)
            } else {
              resolve(true)
            }
          }
        }
      })
    })
  }

  getLastID = async function () {
    return new Promise((resolve, reject) => {
      const query = `SELECT ID FROM new_patients ORDER BY ID DESC LIMIT 1`;

      connection.query(query, function (err, result) {
        if (err) {
          console.log(err)
        } else {
          resolve(result)
        }
      })
    })
  }

  generatePatientId = async () => {
    const date = new Date();
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();

    const lastid = await this.getLastID();
    if (lastid.length == 0) {
      return `${year}${month}${day}`
    } else {
      const { ID } = lastid[0];
      return `${year}${month}${day}${ID}`
    }
  }

  checkPatientIdExist = async (patientid) => {
    return new Promise((resolve, reject) => {
      let useKey;
      if (patientid) {
        useKey = patientid
      } else {
        useKey = this.patientid;
      }

      const query = `SELECT * FROM new_patients WHERE PATIENTID = ?`;
      //  execute query
      connection.query(query, [useKey], function (err, result) {
        if (err) {
          reject(err)
        } else {
          if (result.length == 0) {
            resolve(false)
          } else {
            resolve(true)
          }
        }
      })
    })
  }

  checkEmailOrMobileExist = async (email, mobile) => {
    if (email || mobile) {
      return new Promise((resolve, reject) => {
        const query = `SELECT * FROM new_patients WHERE EMAIL = ? OR MOBILE_NUMBER = ?`;
        const values = [email, parseInt(mobile)];
        connection.query(query, values, function (err, result) {
          if (err) {
            reject(err);
          } else {
            if (result.length > 0) {
              resolve(true);
            } else {
              resolve(false)
            }
          }
        })
      })
    } else {
      return
    }
  }

  personalInformation = async (id, records) => {
    return new Promise((resolve, reject) => {
      const { firstname, lastname, middlename, age, ageType, gender, email, mobile, days, months, maritalstatus, occupation, patientOrganization, years } = records;

      const query = `INSERT INTO new_patients (PATIENTID,FIRSTNAME,LASTNAME,MIDDLENAME,EMAIL,AGE,AGETYPE,DOB,MARITAL_STATUS,MOBILE_NUMBER,OCCUPATION,GENDER,ORGANIZATION)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`;
      // query values
      const values = [id, firstname, lastname, middlename, email, age, ageType, `${years}-${months}-${days}`, maritalstatus, mobile, occupation, gender, patientOrganization]
      // execute query
      connection.query(query, values, function (err, result) {
        if (err) {
          reject(err)
        } else {
          resolve(result.affectedRows)
        }
      })
    })
  }


  addressingInformation = async (id, records) => {
    return new Promise((resolve, reject) => {
      const { area, region, gpsLocation, address } = records;
      //  update the record of the addressing information table using the result query
      const query = `UPDATE patientsaddress SET area = ?,region = ?,gpsLocation = ?,address = ? WHERE patientid = ?`;

      const values = [area, region, gpsLocation, address, id];
      // execute the query
      connection.query(query, values, function (err, result) {
        if (err) {
          reject(err)
        } else {
          resolve(result.affectedRows)
        }
      }
      )
    })
  }

  emmergencyInformation = async (id, records) => {
    return new Promise((resolve, reject) => {
      const { emmergencyContact, emmergencyContactNumber, relationship, location, address, occupation } = records;
      //  update the record of the addressing information table using the result query
      const query = `UPDATE patientemmergencycontactinformation SET emmergencyContactName = ?,emmergencyContactNumber = ?,
    relationship = ?,occupation = ?, address = ? WHERE patientid = ?`;
      // execute the query
      const values = [emmergencyContact, emmergencyContactNumber, relationship, occupation, address, id];
      // execute the query
      connection.query(query, values, function (err, result) {
        if (err) {
          reject(err)
        }
        else {
          resolve(result.affectedRows)
        }
      })
    })
  }


  addNewPatient = async (request, response) => {
    const { personalInformation, addressingInformation, emmergencyInformation } = request.body;
    // destructure information from the personal information provided
    // we will push the data into the new patient table in the database
    try {
      const id = await this.generatePatientId();
      const idExist = await this.checkPatientIdExist(id)
      const EmailNumberExist = await this.checkEmailOrMobileExist(personalInformation.email, personalInformation.mobile)
      // if false we insert into the database table
      if (EmailNumberExist) {
        response.send({
          status: "warning",
          message:
            "client exist in the database, kindly activate client to continue",
          statusCode: 404,
        });
      }
      else {
        if (idExist == false) {
          let result = await this.personalInformation(id, personalInformation);
          // if the result is 1 then we have successfully added the patient information
          if (result == 1) {
            if (await this.isBulkRegistration() == true) {
              let insetAddress = await this.addressingInformation(id, addressingInformation);
              if (insetAddress) {
                let insetEmmergency = await this.emmergencyInformation(id, emmergencyInformation);
                if (insetEmmergency == 1) {
                  response.send({
                    status: "success",
                    message: "patient information added successfully",
                    statusCode: 200,
                  });
                } else {
                  response.send({
                    status: "error",
                    message: "failure in adding patient emmergency information",
                    statusCode: 500,
                  });
                }
              } else {
                response.send({
                  status: "error",
                  message: "failure in adding patient address information",
                  statusCode: 500,
                });
              }

            } else {
              response.send({
                status: "success",
                message: "patient information added successfully",
                statusCode: 200,
              });
            }
          }
        } else {
          while (idExist == true) {
            let currentid = await this.generatePatientId();
            let existid = await this.checkPatientIdExist(currentid);
            if (existid == false) {
              let result = await this.personalInformation(currentid, personalInformation);
              // if the result is 1 then we have successfully added the patient information
              if (result == 1) {
                response.send({
                  status: "success",
                  message: "patient information added successfully",
                  statusCode: 200,
                });
              }
              else {
                response.send({
                  status: "error",
                  message: "patient information not added",
                  statusCode: 500,
                });
              }
              break;
            }
          }
        }
      }
    } catch (error) {
      response.send({
        status: "error",
        message: "An error occured while trying to add new patient",
        statusCode: 500,
        error: error
      })
    }
  }

  UpdatePersonalInformation = async (request, response) => {
    if (await this.checkPatientIdExist()) {
      const { firstname, lastname, middlename, age, ageType, gender, email, mobile, days, months, maritalstatus, occupation, patientOrganization, years } = request.body;

      const query = `UPDATE new_patients 
                   SET FIRSTNAME=?, LASTNAME=?, MIDDLENAME=?, EMAIL=?, AGE=?, AGETYPE=?, DOB=?, MARITAL_STATUS=?, MOBILE_NUMBER=?, OCCUPATION=?, GENDER=?, ORGANIZATION=?
                   WHERE PATIENTID=?`;

      // query values
      const values = [firstname, lastname, middlename, email, age, ageType, `${years}-${months}-${days}`, maritalstatus, mobile, occupation, gender, patientOrganization, this.patientid];

      // execute query
      connection.query(query, values, function (err, result) {
        if (err) {
          logger(err)
        } else {
          response.send({
            message: 'record updated successfully',
            statusCode: 200,
            status: 'success'
          })
        }
      });
    } else {
      customError(`patient id not found`, 404, response)
    }
  }

  updateCredentials = async function (request,response) {
    
  }

}






module.exports = Registration;