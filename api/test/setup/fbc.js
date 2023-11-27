const { promisifyQuery, customError } = require("../../../helper");
const logger = require("../../../logger");
const database_queries = require("../../database/queries");
const connection = require("../../db");
// steps
// 1. state clearlly category and check db if data for category exist
// 2. if exist , clear all the information and load new set of information.
// 3. if exist not, save all the information and notify client of success.


const DB_TABLE_MALE = 'setup_full_blood_count_test_male';
const DB_TABLE_FEMALE = 'setup_full_count_count_female';
const DB_TABLE_GENERAL = 'setup_full_blood_count_test_general';
const DB_TABLE_CREATE_PARAMS = 'setup_fullcount_paramters'

/**
 * Determines the table name in the database based on the test query and options provided.
 * 
 * @param {string} opts - The test query or option.
 * @param {string} [patientid] - The patient ID.
 * @returns {string} - The table name in the database based on the provided test query or option.
 */
const category_determiner = function (opts, patientid) {
  let optsCot = new String(opts).toLowerCase();
  switch (optsCot) {
    case 'male':
      return DB_TABLE_MALE;
    case 'female':
      return DB_TABLE_FEMALE;
    case 'children':
      return DB_TABLE_GENERAL;
    case 'params':
      return DB_TABLE_CREATE_PARAMS;
    case 'filling':
      return getAge(patientid);
    default:
      return optsCot + ' ' + 'not defined';
  }
}


/**
 * Returns the appropriate database table name based on the patient's age, gender, and age type.
 * 
 * @param {number} patientid - The ID of the patient (optional, default: null).
 * @param {number} billingid - The ID of the billing (optional, default: null).
 * @returns {Promise<string>} A promise that resolves with the appropriate database table name.
 * @throws {Error} If both patientid and billingid are provided.
 * 
 * @example
 * const tableName = await getAge(patientId, billingId);
 */
const getAge = function (patientid = null, billingid = null) {
  return new Promise((resolve, reject) => {
    let connectionQuery = '';

    if (patientid) {
      connectionQuery = `SELECT * FROM new_patients WHERE PATIENTID = ?`;
    }

    if (billingid) {
      connectionQuery = `SELECT AGE,
            AGETYPE,
            GENDER
          FROM performing_test AS pt
            INNER JOIN new_patients AS np ON np.PATIENTID = pt.PATIENTID
          WHERE BILLINGID = ${billingid}`;
    }

    if (patientid && billingid) { logger.error(err); }

    connection.query(connectionQuery, patientid, function (err, result) {
      if (err) {
        reject(err);
      }
      else {
        const data = result[0];
        if (data) {
          const { AGE, AGETYPE, GENDER } = data;
          if (GENDER == 'female' && AGE > 10 && AGETYPE == 'years') {
            resolve(DB_TABLE_FEMALE)
          } else if (GENDER == 'male' && AGE > 10 && AGETYPE == 'years') {
            resolve(DB_TABLE_MALE)
          }
          else {
            resolve(DB_TABLE_GENERAL)
          }
        }
      }
    })
  })
}

  /**
   * Inserts data into a database table based on the category and setup data provided in the request body.
   * 
   * @param {object} request - The request object containing the category, setupdata, and setup properties in the body.
   * @param {object} response - The response object used to send a response back to the client.
   * @returns {void}
   */
  
const insertdata = async function (request, response) {
  const { category, setupdata, setup } = request.body;

  if (!category || !setupdata || !(Array.isArray(setupdata))) {
    customError('category or setupdata not defined or setupdata not in an array format', 404, response);
    return;
  } else {
    try {
      let category_table = category_determiner(category);
      // truncate table
      const truncateTable = `TRUNCATE TABLE ${category_table}`;
      const insertData = `INSERT INTO ${category_table} (parameter,unit,lower,upper) VALUES (?,?,?,?)`;
      await promisifyQuery(truncateTable);
      // insert data
      if (setupdata && setupdata.length > 0) {
        let counter = 0;
        for (const item of setupdata) {
          const { parameter, unit, lower, upper } = item;
          await promisifyQuery(insertData, [parameter, unit, lower, upper]);
          counter++;
        }
        if (counter == setupdata.length) { response.send({ message: 'data inserted successfully', statusCode: 200, status: 'success' }) }
      }
    } catch (error) {
      logger.error(error);
      customError(error.message, 500, response);
    }
  }
}


const getdata = async (request, response) => {
  let { category, patientid } = request.query
  let category_table = '';
  if (patientid) { category_table = await category_determiner(category, patientid) } else { category_table = category_determiner(category); }

  if (category) {
    try {
      const result = await promisifyQuery(`SELECT * FROM ${category_table}`);
      response.send({ statusCode: 200, message: 'data fetched successfully', result, status: 'success' })
    } catch (error) {
      logger.error(error);
      customError(error.message, 500, response);
    }
  } else {
    response.send({
      message: category + " " + 'not defined'
    })
  }

}



const getCreatedParams = async function (request, response) {
  connection.query(`SELECT * FROM ${DB_TABLE_CREATE_PARAMS}`, (err, result) => {
    if (err) {
      response.send({
        status: 'error',
        statusCode: 200,
        message: 'occured in fetching data',
      })
    }
    else {
      response.send({
        status: 'success',
        statusCode: 200,
        message: 'data fetched successfully',
        data: result
      })
    }
  }
  )
}

const deleteData = async function (request, response) {
  const { id, category } = request.query;

  if (!id && !category) {
    response.send({
      status: 'error',
      statusCode: 401,
      message: ' delete id or category not included'
    })
  }
  else {
    let results = await database_queries.del(id, category_determiner(category), 'FBCID');

    if (results.affectedRows === 1) {
      response.send({
        status: 'success',
        message: 'Parameter successfully deleted',
        statusCode: 200
      })
    }
    else {
      response.send({
        status: 'error',
        message: 'Error occured in deleting parameter',
        statusCode: 401
      })
    }
  }
}





module.exports = {
  insertdata,
  getdata,
  deleteData,
  getCreatedParams,
  category_determiner,
  getAge
}


