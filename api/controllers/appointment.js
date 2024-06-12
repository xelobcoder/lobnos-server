const router = require("express").Router();
const {default:Appointment} = require("../../dist/models/appointments/appointments");
const { customError, responseError } = require("../../helper");

router.post("/api/v1/appointments/create", async function (request, response) {
  const isAppointmentCreated = await new Appointment(21).createAppointment(request.body);
  response.send({ success:  isAppointmentCreated })
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


router.get("/api/v1/appointments/practioner/slots", async function (request, response) {
  try {
    const { employeeid, appointment_date = new Date() } = request.query;
    if (!employeeid && isNaN(employeeid)) return customError("Bad Request.Employeeid not provided", 404, response);
    const slots = await new Appointment(employeeid)
      .getPractionerAvailableTime(employeeid, appointment_date);
    response.send(slots);
  } catch (err) {
    responseError(response);
  }
})

module.exports = router;