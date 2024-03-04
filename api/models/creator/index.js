const { promisifyQuery, rowAffected } = require("../../../helper")
const testpanel = require("../../testpanel/list")

class Creator {
  constructor(testid) {
    this.testid = testid
  }

  async getTestCreationRule() {
    if (!this.testid) throw new Error("testid is required")
    let rule = await promisifyQuery(`SELECT creationrule FROM customtestcreation WHERE testid = ?`, [this.testid])
    if (rule.length > 0 && rule[0]["creationrule"] != "{}") {
      let result = JSON.parse(rule[0]["creationrule"])
      return result
    } else {
      return []
    }
  }

  async getCustomPreviousRecords(testname, billingid, patientid) {
    const tablename = "result" + testpanel.generateTableName(testname)
    const previousRecords = await promisifyQuery(`SELECT * FROM ${tablename} WHERE billingid = ? AND patientid = ?`, [billingid, patientid])
    let result = await this.getTestCreationRule()

    if (previousRecords.length == 0) return result
    result = result.map((item, index) => {
      const { name } = item
      const matched = previousRecords.find((u, inx) => {
        return u.field == name
      })
      if (matched) {
        return { ...item, value: matched?.value }
      } else {
        return item
      }
    })
    return result
  }

  async getCustomCommentsRecords(billingid, testid) {
    if (!billingid || !testid) {
      throw new Error('testid and billingid required');
    }
    let comments = await promisifyQuery(`SELECT comments FROM result_comments WHERE billingid = ? AND testid = ?`, [billingid, testid]);
    comments = comments.length > 0 ? comments[0]["comments"] : "";
    return comments;
  }

  async updateTestCreationRule(data) {
    if (!this.testid || !data) throw new Error("testid and data  is required")
    const query = `UPDATE customtestcreation SET creationrule = ? WHERE testid = ?`
    const isUpdated = await promisifyQuery(query, [data, this.testid])
    return rowAffected(isUpdated)
  }
}

module.exports = Creator
