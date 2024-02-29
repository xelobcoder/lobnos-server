const { promisifyQuery, rowAffected } = require("../../../helper")

class Creator {
  constructor(testid) {
    this.testid = testid
  }

  async getTestCreationRule() {
    if (!this.testid) throw new Error("testid is required")
    let rule = await promisifyQuery(`SELECT creationrule FROM customtestcreation WHERE testid = ?`, [this.testid])
    if (rule.length > 0 && rule[0]["creationrule"] != "{}") {
      return JSON.parse(rule[0]["creationrule"])
    } else {
      return []
    }
  }

  async updateTestCreationRule(data) {
      if (!this.testid || !data) throw new Error("testid and data  is required");
      const query = `UPDATE customtestcreation SET creationrule = ? WHERE testid = ?`;
      const isUpdated = await promisifyQuery(query, [data, this.testid]);
      return rowAffected(isUpdated);
  }
}

module.exports = Creator
