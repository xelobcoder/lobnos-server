const router = require("express").Router();
const { customError, responseError } = require("../../helper");
const Expenses = require('../models/Expenses/Expense');
const multer = require("multer");
const path = require("node:path");

const storage = multer.diskStorage({
      destination: function (req, file, cb) {
            cb(null, 'api/uploads/receipts');
      },
      filename: function (req, file, cb) {
            cb(null, req.query.id + '-' + Date.now() + path.extname(file.originalname));
      }
});

const upload = multer({ storage: storage });

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

router.get('/api/v1/expenses/record/single', async function (request, response) {
      try {
            const { expenseid } = request.query;
            if (!expenseid) {
                  return customError(`expenseid not provided`, 404, response);
            }
            const record = await new Expenses().getSingleExpense(expenseid);
            response.send(record);
      } catch (err) {
            if (err?.message) {
                  response.send({ status: 'error', err })
            } else {
                  return responseError(response);
            }
      }
})



router.post('/api/v1/expenses/receipt/upload', upload.array("images", 10), async function (request, response) {
      try {
            response.send({ status: "success" })
      } catch (err) {
            console.log(err);
      }
})

router.get('/api/v1/expenses/receipt/upload/images', async function (request, response) {
      const { imageid } = request.query;
      if (!imageid) {
            return customError(`image not provided`, 404, response);
      }
      response.sendFile(path.join(__dirname, `../uploads/receipts/${imageid}`))
})



module.exports = router;