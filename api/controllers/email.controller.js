const router = require('express').Router();
const { customError } = require('../../helper');
const EmailService = require('../EmailServices/email');


router.get("/api/v1/email/summary", async function (request, response) {
  await new EmailService().emailSummary(response);
})


router.get("/api/v1/email/summary/daily", async function (request, response) {
  await new EmailService().getEmailSummaryByDay(response);
 })

router.get("/api/v1/email/logs", async function (request, response) {
  await new EmailService().getEmailLog(1,20,response);
})


router.get("/api/v1/email/custom/search", async function (request, response) { 
  const { email, category } = request.query;
  if (!email || !category) { customError(response, 400, "Email and Category are required"); return;}
  let result = await new EmailService().customSearch(request.query, response);
  Array.isArray(result) ? response.send({statusCode: 200, result})
   : response.send({statusCode: 400, message: result});
})



router.post("/api/v1/email/composed/draft", async function (request, response) {
  const { subject, draft, employeeid } = request.body;
  console.log(request.body);
  if (!subject || !draft || !employeeid) { customError("Subject,Draft and employeeid are required",404,response); return;}
  const result = await new EmailService().saveComposedEmailDraft(subject, draft, employeeid);
  response.send({
    message: result == 1 ? "Draft saved successfully" : "Error saving draft",
    statusCode: result == 1 ? 200 : 400,
    status: result == 1 ? "success" : "error"
  })
})

router.get("/api/v1/email/composed/draft", async function (request, response) { 
  try {
    const result = new EmailService().getComposedEmailDraft(response);
    response.send({statusCode: 200, result,status: "success"})
  } catch (error) {
    customError(error?.message || "Error getting draft", 400, response);
  }
})

module.exports = router;