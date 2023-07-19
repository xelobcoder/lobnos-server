const connection = require("../db");

// define table names as setup in database
const LIVER_SETUP = "setup_liver_function_test";
const RENAL_SETUP = "setup_renal_function_test";
const LIVER_CLIENT_TABLE = "liver_function_test";
const RENAL_CLIENT_TABLE = "renal_function_test";
const CARDIAC_ENZYMES = "setup_cardiac_enzymes";
const THYROID_SETUP = "setup_thyroid_test";
const LIPID_PROFILE_SETUP = "setup_lipid_profile_test";
const BETAHCG = `setup_beta_hcg`;
const ELECTROPHORESIS_SETUP = `haemoglobinelectrophoresis`;
const ESR = `setup_esr`;
const LHHORMONE = 'LHSETUP';
const FSHHORMONE = 'FSHSETUP';

// define our queries
const ChemistryQueries = {
  LIVER_SETUP: `INSERT INTO ${LIVER_SETUP} (parameter,unit,lower,upper) VALUES ?`,
  RENAL_SETUP: `INSERT INTO ${RENAL_SETUP} (parameter,unit,lower,upper) VALUES ?`,
  CARDIAC_ENZYMES: `INSERT INTO ${CARDIAC_ENZYMES} (parameter,unit,lower,upper) VALUES ?`,
  THYROID_SETUP: `INSERT INTO ${THYROID_SETUP} (parameter,unit,lower,upper) VALUES ?`,
  LIPID_PROFILE_SETUP: `INSERT INTO ${LIPID_PROFILE_SETUP} (parameter,unit,lower,upper) VALUES ?`,
  ESR: `INSERT INTO ${ESR} (agelimit,gender,upper,lower) VALUES  ?`,
  ELECTROPHORESIS_SETUP: `INSERT INTO ${ELECTROPHORESIS_SETUP} (parameter,unit,lower,upper) VALUES ?`,
  LHHORMONE: `INSERT INTO ${LHHORMONE}(parameter,unit,lower,upper,gender) VALUES ?`,
  FSHHORMONE: `INSERT INTO ${FSHHORMONE}(parameter,unit,lower,upper,gender) VALUES ?`,
};

const chemistryTables = {
  LIVER_SETUP,
  RENAL_SETUP,
  LIVER_CLIENT_TABLE,
  RENAL_CLIENT_TABLE,
  CARDIAC_ENZYMES,
  THYROID_SETUP,
  LIPID_PROFILE_SETUP,
  ESR,
  ELECTROPHORESIS_SETUP,
  LHHORMONE,
  FSHHORMONE,
};

class Chemistry {
  constructor(testname, data) {
    this.testname = testname;
    this.data = data;
  }

  // validate data
  validateData() {
    if (!this.data) return false;
    if (this.data.length === 0) return false;
    if (this.data === undefined) return false;
    if (this.data === null) return false;
    if (this.data.length > 0) {
      // must satisfy paramter, unit, lower, upper
      for (let i = 0; i < this.data.length; i++) {
        for (let j = 0; j < this.data[i].length; j++) {
          if (this.data[i][j] === undefined) return false;
          if (this.data[i][j] === null) return false;
          if (this.data[i][j] === "") return false;
        }
      }
    }
    return true;
  }

  clearTable() {
    // check table is coded for in chemistry tale
    if (!(this.testname in chemistryTables)) return;
    // truncate table
    let query = `TRUNCATE TABLE ${chemistryTables[this.testname]}`;
    return new Promise((resolve, reject) => {
      connection.query(query, (err, result) => {
        if (err) reject(err);
        resolve(result);
      });
    });
  }

  insertData(req, res) {
    let query = ChemistryQueries[this.testname];
    let values = this.data;

    // sanitize data
    const sanitizeData = values.map((item) => {
      const { parameter, unit, upper, lower, agelimit, gender } = item;

      if (this.testname == "ESR") {
        return [agelimit, gender, upper, lower];
      } else if (
        this.testname == "LHHORMONE" ||
        this.testname == "FSHHORMONE"
      ) {
        return [parameter, unit, lower, upper, gender];
      } else {
        return [parameter, unit, lower, upper];
      }
    });

    // execute query
    connection.query(query, [sanitizeData], (err, result) => {
      if (err) {
        res.status(400).send({
          message: err.message,
          statusCode: 400,
        });
        connection.end;
      } else {
        res.status(200).send({
          message: "success",
          statusCode: 200,
        });
      }
    });
  }

  getRecords(req, res) {
    const panelname = req.query.panelname;

    // check if table exist
    // check if records is greater than 0
    // fetch all records
    if (!panelname) {
      res.status(404).send({
        message: "include panelname",
        status: "info",
        statusCode: 404,
      });
    }

    if (panelname in chemistryTables) {
      let query = `SELECT * FROM ${chemistryTables[panelname]}`;
      // execute query
      connection.query(query, function (err, result) {
        if (err) {
          res.status(500).send({
            message: err.message,
            status: "error",
          });
        }
        if (result) {
          let sanitizer = result.map((item) => {
            if (item?.gender || item?.GENDER) {
              return {
                setupid: item.SETUPID || item.setupid,
                parameter: item.PARAMETER || item.parameter,
                upper: item.UPPER || item.upper,
                lower: item.LOWER || item.lower,
                unit: item.UNIT || item.unit,
                gender: item.GENDER || item.gender
              };
            } else {
              return {
                setupid: item.SETUPID || item.setupid,
                parameter: item.PARAMETER || item.parameter,
                upper: item.UPPER || item.upper,
                lower: item.LOWER || item.lower,
                unit: item.UNIT || item.unit,
              };
            }

          });
          res.status(200).send({
            status: "success",
            statusCode: 200,
            records: panelname == "ESR" ? result : sanitizer,
          });
        }
      });
    } else {
      res.status(404).send({
        message: "invalid data,include proper panelname",
        statusCode: 400,
        status: "error",
      });
    }
  }

  getBetaHcg(response) {
    connection.query("SELECT * FROM setup_beta_hcg", function (err, result) {
      if (err) {
        throw err;
      }
      if (result) {
        response.send({
          statusCode: 200,
          records: result,
          status: "success",
        });
      }
    });
  }
}

module.exports = Chemistry;
