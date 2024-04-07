const router = require("express").Router();
const { customError } = require("../../helper");
const Expenses = require('../models/Expenses/Expense');

router.post("/api/v1/expenses", async function (request, response) {
      new Expenses().generateNewExpense(request.body, response);
})

router.get('/api/v1/expenses/records', async function (request, response) {
      const { employeeid, branchid, count, page, status } = request.query;
      if (!employeeid) {
            return customError('employeeid required', 404, response);
      }
      const records = await new Expenses().getExpensesRecord(employeeid, branchid, status, { page, count });
      response.send(records);
})




module.exports = router;