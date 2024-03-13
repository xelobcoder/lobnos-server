const { response } = require("express")
const { promisifyQuery, rowAffected, responseError } = require("../../../helper")
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
    try {
      const tablename = "result" + testpanel.generateTableName(testname)
      const previousRecords = await promisifyQuery(`SELECT * FROM ${tablename} WHERE billingid = ? AND patientid = ?`, [
        billingid,
        patientid,
      ])
      let result = await this.getTestCreationRule()

      const hasGenderVariation = result.length == 0 ? false : result.filter((item) => item.hasGenderVariation == true).length > 0

      let clientGender = ""

      if (hasGenderVariation) {
        const packet = await promisifyQuery(`SELECT gender,age,agetype FROM new_patients WHERE patientid = ?`, patientid)
        if (packet.length > 0) clientGender = packet[0]["gender"]
      }

      if (previousRecords.length == 0) return result

      result = result.map((item, index) => {
        const { name } = item
        const matched = previousRecords.find((u, inx) => {
          return u.field == name
        })
        let returnItem = ""
        if (matched) {
          returnItem = { ...item, value: matched?.value }
        } else {
          returnItem = item
        }
        return returnItem
      })

      if (hasGenderVariation && clientGender) {
        result = result.map((item, index) => {
          const obj = {}
          for (const [key, value] of Object.entries(item)) {
            obj[key] = value
            if (item.hasOwnProperty(clientGender)) {
              if (clientGender == "male") {
                obj["upperlimit"] = item[clientGender].upperlimit
                obj["lowerlimit"] = item[clientGender].lowerlimit
              } else {
                obj["upperlimit"] = item[clientGender].upperlimit
                obj["lowerlimit"] = item[clientGender].lowerlimit
              }
              delete obj.female
              delete obj.male
            }
          }
          return obj
        })
      }
      return result
    } catch (err) {
      console.log(err)
      responseError(response)
    }
  }

  async getCustomCommentsRecords(billingid, testid) {
    if (!billingid || !testid) {
      throw new Error("testid and billingid required")
    }
    let comments = await promisifyQuery(`SELECT comments FROM result_comments WHERE billingid = ? AND testid = ?`, [billingid, testid])
    comments = comments.length > 0 ? comments[0]["comments"] : ""
    return comments
  }

  async updateTestCreationRule(data) {
    if (!this.testid || !data) throw new Error("testid and data  is required")
    const stringdata = JSON.stringify(data)
    const query = `UPDATE customtestcreation SET creationrule = ? WHERE testid = ?`
    const isUpdated = await promisifyQuery(query, [stringdata, this.testid])
    return rowAffected(isUpdated)
  }
}

module.exports = Creator
