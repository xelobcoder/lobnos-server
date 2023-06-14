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

// this gets the table name in the db based on the test query and options in the case of full blood count 
const category_determiner = function (opts, patientid) {
  //  convert string to lowercase 
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


// this function takes in the patient id and returns the age 
// also if the billingid is given , then the billingid is used
// on of the paramters  must be null or an error will thrown
// this is for filling incase category is given by the client

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

    if (patientid && billingid) { throw err; }
    
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

const insertdata = function (request, response) {

  const { category, setupdata, setup } = request.body;

  if (!category || category == null || category == undefined) {
    response.send({
      error: 'category essential'
    })
  }


  if (category && setupdata) {
    let category_table = category_determiner(category)
    // delete all rows first
    database_queries.deleteAllrows(category_table)
      .then((resolve) => {
        // if all records are deleted ,resolves true else resolves false
        let count = 0;
        setupdata.map((item) => {
          let SQL_QUERY = `INSERT INTO ${category_table} (PARAMETER,UNIT,LOWER,UPPER) VALUES (?,?,?,?)`
          connection.query(SQL_QUERY, [item.PARAMETER, item.UNIT, item.LOWER, item.UPPER], (err, result) => {
            if (err) { console.log(err) }
            count++;
            count == setupdata.length ? response.send({ message: 'data inserted successfully' }) : null
          })
        })
      })
  }
}


const getdata = async (request, response) => {
  let { category, patientid } = request.query

  let category_table = '';

  if (patientid) {
    category_table = await category_determiner(category, patientid)
  } else {
    category_table = category_determiner(category);
  }

  if (category) {
    let SQL_QUERY = `SELECT * FROM ${category_table}`;
    connection.query(SQL_QUERY, (err, result) => {
      if (err) {
        response.send({
          status: 'error',
          statusCode: 200,
          message: 'occured in fetching data',
        })
      }
      else {
        const xlen = result.length;
        if (xlen === 0) {
          const results = async function () {
            let data = await database_queries.getall(`setup_fullcount_paramters`);
            response.send(data)
          }
          results()
        }
        else {
          response.send(result)
        }
      }

    })
  }
  else {
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
  getAge
}


