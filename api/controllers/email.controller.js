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
  if (!subject || !draft || !employeeid) { customError("Subject,Draft and employeeid are required",404,response); return;}
  const result = await new EmailService().saveComposedEmailDraft(subject, draft, employeeid);
  response.send({
    message: result == 1 ? "Draft saved successfully" : "Error saving draft",
    statusCode: result == 1 ? 200 : 400,
    status: result == 1 ? "success" : "error"
  })
})

router.get("/api/v1/email/composed/draft", async function (request, response) { 
  const { mode, id, target, limit } = request.query;
  try {
    const result = await new EmailService().getComposedEmailDraft(target,limit,mode,id);
    response.send({statusCode: 200, result,status: "success"})
  } catch (error) {
    customError(error?.message || "Error getting draft", 400, response);
  }
})


router.put("/api/v1/email/composed/draft", async function (request, response) {
  const { id, subject, draft, employeeid } = request.body;
  if (!id || !subject || !draft || !employeeid) { customError("Id,Subject,Draft and employeeid are required",404,response); return;}
  const result = await new EmailService().updateEmailComposed(id, subject, draft, employeeid);
  response.send({
    message: result == 1 ? "Draft updated successfully" : "Error updating draft",
    statusCode: result == 1 ? 200 : 400,
    status: result == 1 ? "success" : "error"
  })
})
 

router.post("/api/v1/email/publish", async function (request, response) {
  const { id } = request.body;
  if (!id) { customError("Id is required", 404, response); return; }
  const result = await new EmailService().publishEmail(request.body);
  if (result != true) {
     customError(result,404,response);
   }
 })
module.exports = router;