const { customError } = require("../../../helper")
const logger = require("../../../logger")

class ApplicationSettings {
  constructor(id) {
    this.id = 1
  }

  async getApplicationSettings(request, response) {
    const query = `SELECT * FROM applicationsettings`
    try {
      let result = await promisifyQuery(query)
      if (!response) {
        return promisifyQuery(query)
      } else {
        response.send({ message: "success", status: "success", statusCode: 200, result })
      }
    } catch (err) {
      logger.error(err)
    }
  }

  async getEmailPreference() {
    const data = await database_queries.getsingleid(1, "emailpreference", "id")
    return data.length > 0 ? data[0] : {}
  }

  async shouldSendRejectionEmail() {
    const settings = await this.getApplicationSettings()
    let isServicesActivated = false
    let isRejectedPrefered = false
    if (settings.length > 0 && settings[0]["emailNotification"] == 1) {
      isServicesActivated = true
    }

    const rejectionPreference = await this.getEmailPreference()
    if (rejectionPreference.length && rejectionPreference?.rejection == "Yes") {
      isRejectedPrefered = true
    }
    if (isRejectedPrefered && isServicesActivated) return true
    else return false
  }

  async updateApplicationSettings() {
    const {
      bulkregistration,
      emailNotification,
      fontsize,
      textcolor,
      DeactivateBilling24hrs,
      BackgroundColor,
      PaidBillsBeforeTransaction,
      completeFlow,
      approvalbeforeprinting,
    } = request.body
    const query = `INSERT INTO applicationsettings (bulkregistration,fontsize,textcolor,BackgroundColor,DeactivateBilling24hrs,PaidBillsBeforeTransaction,completeFlow,approvalbeforeprinting,emailNotification) VALUES (?,?,?,?,?,?,?,?,?)`
    const TruncateTable = `TRUNCATE TABLE applicationsettings`
    const values = [
      bulkregistration,
      fontsize,
      textcolor,
      BackgroundColor,
      DeactivateBilling24hrs,
      PaidBillsBeforeTransaction,
      completeFlow,
      approvalbeforeprinting,
      emailNotification,
    ]
    try {
      const result = await promisifyQuery(TruncateTable)
      if (result) {
        const isUpdated = await promisifyQuery(query, values)
        isUpdated && response.send({ message: "Applications settings updated successfully", statusCode: 200, status: "success" })
      }
    } catch (err) {
      logger.error(err)
      customError(err?.message, 500, response)
    }
  }

  async updateSmsSettings(request, response) {
    try {
      const updateSms = await promisifyQuery(`UPDATE applicationsettings SET smsSettings = ?`, [JSON.stringify(request.body)])
      if (updateSms) {
        response.send({ message: "sms settings updated successfully", status: "success", statusCode: 200 })
      }
    } catch (err) {
      customError(err?.message, 500, response)
    }
  }

  async getSmsSettings(request, response) {
    try {
      const result = await promisifyQuery(`SELECT smsSettings FROM applicationsettings`)
      if (result.length > 0) {
        const { smsSettings } = result[0]
        response.send(JSON.parse(smsSettings))
      } else {
        response.send({ registration: "", result: "", sample: "", birthday: "" })
      }
    } catch {
      customError("error occured getting sms settings", 404, response)
      logger.error(err)
    }
  }

  async updatePreference(request, response) {
    const { registration, rejection, result, approval, transactions, birthday, billing } = request.body
    // truncate the table
    const truncate = await promisifyQuery(`TRUNCATE TABLE emailpreference`)

    if (!truncate) {
      customError("error occured", 500, response)
      return
    }

    const query = `INSERT INTO emailpreference (registration,result,rejection,approval,transactions,birthday,billing) VALUES (?,?,?,?,?,?,?)`
    const values = [registration, result, rejection, approval, transactions, birthday, billing]
    try {
      const result = await promisifyQuery(query, values)
      if (result) {
        response.send({ message: result.affectedRows == 1 ? "updated successfully" : "update failed", status: "success", statusCode: 200 })
      }
    } catch (err) {
      logger.error(err)
      customError(err?.message, 500, response)
    }
  }
  async getGeneralEmailSettings(records) {
    if (typeof records != "object") return false
    // first truncate the table
    const truncate = `TRUNCATE TABLE generalemailsettings`
    let isTruncated = await promisifyQuery(truncate)
    if (isTruncated) {
      return new EmailService().insertEmailSettings(records)
    }
  }
}


module.exports = ApplicationSettings;