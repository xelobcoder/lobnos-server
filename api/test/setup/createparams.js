const connection = require('../../db.js')

const TableNames = {
  liver: 'setup_liver_function_test',
  renal: 'setup_renal_function_test',
  fbc: 'setup_fullcount_paramters',
}

// check if the parameter already is avalilable in the database table

const doHaveParameter = async function (parameterName, columnName, TableName) {
  return new Promise((resolve, reject) => {
    //  create a query to match paramter name with table column;
    const query = `SELECT ${columnName} from ${TableName} WHERE ${columnName} = '${parameterName}'`
    // connect to database
    connection.query(query, (err, result) => {
      err ? reject(err) : resolve(result)
    })
  })
}

const createParameter = async function (tableName,data) {
  // create paramater
  return new Promise((resolve, reject) => {
	  const query = `INSERT INTO ${tableName} (
		PARAMETER,
		UPPER,
		LOWER,
		UNIT
	  ) VALUES (?,?,?,?)`;

	  connection.query(query,data, (err, result) => {
		  err ? reject(err) : resolve(result)
	  })

  })
}

module.exports = { doHaveParameter, createParameter,TableNames }
