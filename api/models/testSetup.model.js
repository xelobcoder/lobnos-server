const  { promisifyQuery, customError } =require('../../helper')
const  logger =  require("../../logger");
class TestSetup {
  constructor(testname) {
    this.testname = testname;
  }


  isValidTestname() {
    return (this.testname in setups) ? true : false;
  }

  async getSetupLiterature(testid) {
    return await promisifyQuery(`SELECT * FROM setupliteraturereview WHERE testid = ?`, [testid])
  }

  async updateSetupLiterature(literature, testid) {
    return await promisifyQuery(`UPDATE setupliteraturereview SET literature = ? WHERE testid= ?`, [literature, testid])
  }

  async canUseLiterature(testid) {
    const data = await promisifyQuery(`SELECT useLiterature from testdetails WHERE testid = ?`, [testid]);
    if (data.length == 0) return false;
    const { useLiterature } = data[0];
    return useLiterature == 1 ? true : false;
  }

  async getResultLiterature(testid) {
    if (await this.canUseLiterature(testid)) {
      const dataset = await this.getSetupLiterature(testid);
      if (dataset.length > 0) {
        return { can: true, literature: dataset[0]['literature'] }
      }
    }
    return { can: false }
  }

  async createSetupLiterature(literature, testname) { 
    try {
      // check if testname exist in the table
    const isNameExist = await this.getSetupLiterature(testname);
    if (isNameExist.length > 0) {
      return await this.updateSetupLiterature(literature, testname);
    } else {
      return await promisifyQuery(`INSERT INTO setupliteraturereview (testname,literature) VALUES(?,?)`, [this.testname || testname, literature])
    }
    } catch (err) {
      logger.error(err);
      throw new Error(err?.message || 'something went wrong');
    }
  }


  async getSetupRecords() { 
    try {
      return await promisifyQuery(`SELECT * FROM ${setups[this.testname]}`);
    } catch (err) {
      logger.error(err);
      return [];
    }
  }

  async validateRecords(records) { 
    if (Array.isArray(records) && records.length > 0) {
      const result = records.map((item) => {
        const values = Object.values(item.toString().trim());
        return (values.includes(undefined) || values.includes(null) || values.includes('') || values.length === 0) ? false : true;
      });
    return result.includes(false) ? false : true;
    } 
  }

  async isParamExist(param, column) {
    const result = await promisifyQuery(`SELECT * FROM ${setups[this.testname]} WHERE ${column} = ?`, [param]);
    return result.length > 0 ? true : false;
  }

  async insertChemistryParam(records) {
    const { parameter, unit, lower, upper, gender } = records;
    let query = gender ?
       `INSERT INTO ${setups[this.testname]} (parameter,unit,lower,upper,gender) VALUES(?,?,?,?,?)`
      :
    `INSERT INTO ${setups[this.testname]} (parameter,unit,lower,upper) VALUES(?,?,?,?)`
    const values = gender ? [parameter, unit, lower, upper, gender] : [parameter, unit, lower, upper]
    const result = await promisifyQuery(query, values);
    return result;
  }

  async insertCultureParam(records) { 
    const { drug } = records;
    // we check if param exist in database 
    await promisifyQuery(`INSERT INTO ${setups[this.testname]} (drug) VALUES(?)`, [drug]);
  }

  insertCultureParam(records) { 
    const { drug } = records;
    return promisifyQuery(`INSERT INTO ${setups[this.testname]} (drug) VALUES(?)`, [drug]);
  }

  async truncateTable() { 
    return await promisifyQuery(`TRUNCATE TABLE ${setups[this.testname]}`);
  }

  async createTestParameter(data,response) {
    try {
      if (this.isValidTestname() && await this.validateRecords(data)) { 
        let current = 0;
        data.forEach(async (item) => {
          const isParameterExist = await this.isParamExist(item.parameter, 'parameter');
          if (!isParameterExist) {
            await this.insertChemistryParam(item);
          }
          current++;
          if (current === data.length) {
            response.send({status: 'success',statusCode: 200,message: 'test parameters created successfully'})
          }
        });
      } else {
        customError('invalid testname', 404, response);
      }
    }catch (err) {
      logger.error(err);
      customError(err?.message || 'something went wrong', 500, response);
    }
  }

  async addEsrParameter(item) { 
    try {
      const query = `INSERT INTO ${setups[this.testname]} (agelimit,upper,lower,gender) VALUES (?,?,?,?)`;
      const { agelimit, upper, lower, gender } = item;
      return await promisifyQuery(query, [agelimit, upper, lower, gender]);
    } catch (err) {
      logger.error(err);
     }
  }
  async updateTestParameter(data,literature, response) { 
    try {
      if (this.isValidTestname() && await this.validateRecords(data)) { 

        const truncate = await this.truncateTable();

        if (truncate?.insertId == 0 && truncate?.fieldCount == 0) {

          let state = 0;

          while (state < data.length) { 
            if (this.testname === 'esr') {
               await this.addEsrParameter(data[state]);
            }
            
            if (!(['esr','bloodCulture'].includes(this.testname))) { 
              await this.insertChemistryParam(data[state]);
            }

            if (this.testname === 'bloodCulture') { 
              await this.insertCultureParam(data[state]);
            }

            state++;

            if (state === data.length) { 
              const pushLiterature = await this.createSetupLiterature(literature);
              if (pushLiterature?.affectedRows > 0) { 
                response.send({status: 'success',statusCode: 200,message: 'test parameters updated successfully'})
              } else {
                customError('updating literature failed', 500, response);
              }
            }
          }
        } else {
          customError('something went wrong', 500, response);
       }
      } else {
       customError('invalid testname or invalid data provided', 404, response);
      }
    } catch (err) {
      logger.error(err);
      customError(err?.message || 'something went wrong', 500, response);
    }
  }

  async deleteSetupParams(setupid,parameter) {
    if (this.isValidTestname() && setupid && parameter) {
      const result = await promisifyQuery(`DELETE FROM ${setups[this.testname]} WHERE setupid = ? AND parameter = ?`, [setupid, parameter]);
      return result?.affectedRows > 0 ? true : false;
    } else {
     throw new Error('test not available or scripted for!!')
    }
  }
}
 



module.exports = TestSetup;