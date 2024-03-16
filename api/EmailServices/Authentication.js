const EmailService = require("./email")

class Authentication extends EmailService {
  constructor(employeeid, role) {
    super(employeeid)
    this.role = role

    if (!this.role || !this.employeeid) {
      console.log(process.env.NODE_ENV)
      throw new Error("role && employeeid is critical")
    }
  }
}

new Authentication(5,6)

module.export = Authentication
