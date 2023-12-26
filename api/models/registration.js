const { customError, promisifyQuery } = require('../../helper');
const connection = require('../db');
const logger = require('../../logger');
const EmailService = require('../EmailServices/email');
const database_queries = require('../database/queries');

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
          if (result.length == 0) resolve(false);
          else {
            const { bulkregistration } = result[0];
            if (bulkregistration == 0) resolve(false)
            else {
              resolve(true)
            }
          }
        }
      })
    })
  }


  temporaryOrder = async (records) => {
    const { clinicianid, data ,patientid} = records;
    if (!clinicianid || !data) return 'please add clinicianid and data';
    try {
      const isRequestedToday = await promisifyQuery(`SELECT * FROM billingtemporarytable WHERE clinicianid = ? AND patientid = ? AND DATE(created_on) = CURRENT_DATE `, [clinicianid, patientid]);
      
      if (typeof data == 'object' && data.length > 0 && isRequestedToday.length == 0) { 
        const transformedData = JSON.stringify(data);
        const query = `INSERT INTO billingtemporarytable (clinicianid,data,patientid) VALUES (?,?,?)`;
        const values = [clinicianid, transformedData,patientid];
        const result = await promisifyQuery(query, values);
        return result.affectedRows == 1 ? true : false;
      }
      return false;
    } catch (err) {
      logger.error(err)
      throw new Error(err);
    }
   }

  getTemporaryOrders = async (target,clinicianid) => { 
    if (!target) return new Error("target for query not provided");

    const values = [];
    try {
      let query = `SELECT * FROM billingtemporarytable  AS bt
      INNER JOIN new_patients  AS np ON np.patientid = bt.patientid`;

      if (target == 'clinician' || target == 'organization') { 
        query += ` WHERE bt.clinicianid = ? AND bt.processed = 0`;
        values.push(clinicianid);
      } else {
        query += ` WHERE bt.processed = 0`
      }
     query += ` ORDER BY bt.orderid DESC LIMIT 20`;

      const result = await promisifyQuery(query, values);
        
    return result;
    } catch (err) {
      logger.error(err);
      console.log(err)
      throw new Error(err);
   }
  }


  getTemporaryOrdersProcessing = async (id) => { 
    try
    {
      let  data = await database_queries.getsingleid(id, 'billingtemporarytable', 'orderid');
      if (data.length == 0) return [];
      const { clinicianid } = data[0];
      const cliniciandata = await database_queries.getsingleid(parseInt(clinicianid), 'clinicianbasicinfo', 'id');

      data = data.map((item) => { 
        if (item.data) {
          item.data = JSON.parse(item.data);
        }
        return item;
      });

      return data[0];
    } catch (err) 
    {
      logger.error(err);
      console.log(err)
      throw new Error(err);
    }
  }
  getLastID = async function() {
    return await promisifyQuery(`SELECT id FROM new_patients ORDER BY id DESC LIMIT 1`)
  };

  generatePatientId =  () => {
    return Date.now();
  }

  checkPatientIdExist = async (patientid) => {
    try {
      let useKey;
      useKey = patientid ? patientid : this.patientid;
    let result = await promisifyQuery(`SELECT * FROM new_patients WHERE PATIENTID = ?`,useKey);
      return result.length > 0 ? true : false;
    } 
   catch (err) {logger.error(err); return false;}
  }

  checkEmailOrMobileExist = async (email, mobile) => {
    if (email || mobile) { 
      try {
        const result = await promisifyQuery(`SELECT * FROM new_patients WHERE EMAIL = ? OR MOBILE_NUMBER = ?`, [email, parseInt(mobile)]);
        return result.length > 0 ? true : false;
      } catch (err) {
        logger.error(err);
        return false;
      }
    }
  }

  isClientSame = async (clientdata) => {
    try {
      const { dob, mobile, mobileownership, email } = clientdata;
      if (mobile.length == 0 && email.length == 0) return false;
     
      const getData = await promisifyQuery(`SELECT * FROM new_patients WHERE mobile_number = ?  AND contactpointer = ? OR email = ?`, [mobile,mobileownership, email]);

      return getData.length > 0 ? true : false;
    } catch (err) {
      logger.error(err);
     }
  }
 
  personalInformation = async (records) => {
    const patientid = this.generatePatientId();
    try { 
      const { firstname, lastname, middlename, age, ageType, gender, email, mobile, days, months, maritalstatus, occupation, patientOrganization, years,mobileownership } = records;

      const query = `INSERT INTO new_patients (patientid,FIRSTNAME,LASTNAME,MIDDLENAME,EMAIL,AGE,AGETYPE,DOB,MARITAL_STATUS,MOBILE_NUMBER,OCCUPATION,GENDER,ORGANIZATION,contactpointer)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
      // query values
      const values = [patientid, firstname, lastname, middlename, email, age, ageType, `${years}-${months}-${days}`, maritalstatus, mobile, occupation, gender, patientOrganization, mobileownership || 'self'];
      // execute query
      const result = await promisifyQuery(query, values);

      return {count: result.affectedRows, id: patientid};
    } catch (err) {
      console.log(err)
      logger.error(err)
    }
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
      const query = `UPDATE patientemmergencycontactinformation SET emmergencyContactName = ?,emmergencyContactNumber = ?, relationship = ?,occupation = ?, address = ? WHERE patientid = ?`;
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
    // if successuly registered, a mail is sent to the client to authenticate email, if only is email is present
    try {
      const isAlreadyRegistered = await this.isClientSame(personalInformation);
      // // if false we insert into the database table
      if (isAlreadyRegistered) {
        response.send({
          status: "warning",
          message: personalInformation?.mobileownership == 'relative' ?
            "Number or emaill associated with a patientid.Please search and bill client to continue"
            :
            "Number or email is a associated with  a different patient. Select relative if person is a relative",
          statusCode: 404,
        });
        return;
      }

      return await this.personalInformation(personalInformation);
      
    } catch (error) {
      console.log(error)
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
  
  async getPatientInfoUsingBillingId(billingid) { 
    const query = `SELECT * FROM new_patients AS np INNER JOIN billing AS b ON b.patientid = np.patientid WHERE b.billingid = ?`;
    const result = await promisifyQuery(query, [billingid]);
    return result;
  }


  async filterPatientUsingClient(input) {
    try {
      //  filter based on the provided input, it could fullname or patientid or mobile number or email
    // we concat db fullname,lastname and middlename to get fullname
      const query = `SELECT DISTINCT * FROM new_patients WHERE CONCAT(firstname,' ',lastname,' ',middlename) LIKE ? OR patientid LIKE ? OR mobile_number LIKE ? OR email LIKE ?`;
      const values = [`%${input}%`, `%${input}%`, `%${input}%`, `%${input}%}`]
      const result = await promisifyQuery(query, values);
     return result;
    } catch (error) {
      logger.error(error)
      return false;
    }
  }
}






module.exports = Registration;