const router = require("express").Router();
const {default:Appointment} = require("../../dist/models/appointments/appointments");

router.post("/api/v1/appointments/create", async function (request, response) {
  const isAppointmentCreated = await new Appointment(21).createAppointment(request.body);
  console.log(isAppointmentCreated);
})


module.exports = router;