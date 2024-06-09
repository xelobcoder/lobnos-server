const router = require("express").Router();
const {default:Appointment} = require("../../dist/models/appointments/appointments");
const { customError } = require("../../helper");

router.post("/api/v1/appointments/create", async function (request, response) {
  const isAppointmentCreated = await new Appointment(21).createAppointment(request.body);
  console.log(isAppointmentCreated);
})


router.get("/api/v1/appointments/client/previous", async function (request, response) {
  const { patientid, count, page } = request.query;
  if (!patientid) {
    return customError("Patientid missing", 404, response);
  }
  const previous = await new Appointment().getPatientAppointmentHistory(patientid, count, page);
  response.send(previous);
})


router.get("/api/v1/appointments/month", async function (request, response) {
  const { month = parseInt(new Date().getMonth()) } = request.query;
  var searchMonth = typeof month == "string" && !isNaN(month) ? parseInt(month) : month; 
  const records = await new Appointment().loadMonthAppointments(searchMonth);
  response.send(records);
})

module.exports = router;