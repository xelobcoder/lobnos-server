const router = require("express").Router()
const { responseError } = require("../../helper")
const User = require("../LobnosAuth/user")
const Security = require("../models/security/Security")

router.get("/api/v1/security/getloggedsessions", async function (request, response) {
          try {
                    const { email } = request.query
                    const user = await new User().getUserData(email)
                    const employeeid = user["employeeid"]
                    const sessions = await new Security(employeeid).getCurrentUserLoginSessionsWithDetails()
                    response.send(sessions)
          } catch (err) {
                    responseError(response)
          }
})


router.get("/api/v1/security/getloggedsessions/update", async function (request, response) {
          const { keyupdate, email } = request.query;
          if (keyupdate == 1) {
                    return;
          } else {
                    const user = await new User().getUserData(email);
                    const employeeid = user["employeeid"]
                    const status = await new Security(employeeid).destroyUserSessions();
                    response.send({status})
          }
})

module.exports = router
