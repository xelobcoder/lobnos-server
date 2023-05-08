const { response } = require("express");
const connection = require("../../db.js");

const TableNames = {
	liver: "setup_liver_function_test",
	renal: "setup_renal_function_test",
	fbc: "setup_fullcount_paramters",
	thyroid: "setup_thyroid_test",
	betahcg: "setup_beta_hcg",
	cardiac: "setup_cardiac_enzymes",
};

// check if the parameter already is avalilable in the database table

const doHaveParameter = async function (parameterName, columnName, TableName) {
	return new Promise((resolve, reject) => {
		//  create a query to match paramter name with table column;
		const query = `SELECT ${columnName} from ${TableName} WHERE ${columnName} = '${parameterName}'`;
		// connect to database
		connection.query(query, (err, result) => {
			err ? reject(err) : resolve(result);
		});
	});
};

const createParameter = async function (tableName, data) {
	// create paramater
	return new Promise((resolve, reject) => {
		const query = `INSERT INTO ${tableName} (
		PARAMETER,
		UPPER,
		LOWER,
		UNIT
	  ) VALUES (?,?,?,?)`;

		connection.query(query, data, (err, result) => {
			err ? reject(err) : resolve(result);
		});
	});
};

const createBetaRanges = async function (records, response) {
	try {
		const queryString = `INSERT INTO setup_beta_hcg
			(WEEKS,LOWER,UPPER,UNIT) VALUES ?`;
		const nv = records.map((item, index) => {
			const { weeks, lower, upper, unit } = item;
			// ensure weeks is a number and then parse it
			return [weeks, lower, upper, unit];
		});

		connection.query(queryString, [nv], function (err, result) {
			if (err) {
				response.send({
					status: "error",
					message: err.message,
					statusCode: 500,
				});
			}

			if (result) {
				response.send({
					status: 'success',
					statusCode: 200,
					message: 'parameter created'
				})
			}
		});
	} catch (err) {
		response.send({
			status: "error",
			message: err.message,
			statusCode: 500,
		})
	}
};

module.exports = {
	doHaveParameter,
	createParameter,
	TableNames,
	createBetaRanges,
};
