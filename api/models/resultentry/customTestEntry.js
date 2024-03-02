const { promisifyQuery } = require("../../../helper")
const { Result } = require("../result")

class CustomTest extends Result {
  constructor(billingid, testname) {
    super(billingid, testname)
  }

  async getAllCustomTestList() {
    const query = `SELECT * FROM test_panels WHERE iscustom = 1`
    return await promisifyQuery(query)
    }
    
}

module.exports = CustomTest
