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

  async isCustomTest(testname) {
    if (!testname) throw new Error("testname required")
    const query = `SELECT * FROM test_panels WHERE name = ?`
    const result = await promisifyQuery(query, [testname])
    if (result.length === 0) return null;
    return result[0]['iscustom'] == 1
  }
}

module.exports = CustomTest
