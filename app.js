const express = require("express");
const os = require("node:os");
const cluster = require("node:cluster");
const app = express();
const emailRouterController = require("./api/controllers/email.controller");
const port = 5000;
const { Billing, getClientBillingInformation, getBilledClients, updateBilling } = require("./api/billing");
const branchesHandler = require("./api/branches");
const resultChecker = require("./api/controllers/results");
const Manager = require('./api/controllers/manager');
const operationsRouter = require("./api/controllers/operations");
// const { getOrganizations } = require("./api/models/organization");
const registrationRouter = require('./api/controllers/registration');
const rejectedRouter = require("./api/controllers/rejected");
const stocksRouter = require("./api/controllers/Inventory/stocks");
const activation = require("./api/activation");
const { getCategory, putCategory, deleteCategory, postCategory } = require("./api/testpanel/categories");
const clinicianRouter = require("./api/controllers/clinicians");
const testpanel = require("./api/testpanel/list");
const { get } = require("./api/center");
const SampleHandler = require("./api/sample");
const ChemistryRoutes = require("./api/controllers/chemistrysetup");
const phelobotomyRouter = require("./api/controllers/phelobotomy");
const supplyRouter = require("./api/controllers/supply");
const settingsRouter = require("./api/controllers/settings");
const User = require("./api/LobnosAuth/user");
const LoginsRouter = require("./api/controllers/logins");
const resultprintRouter = require('./api/controllers/printable')
const organizationRouter = require('./api/controllers/organization');
const applicationsettingsRouter = require('./api/controllers/applicationSettings');
const generalSalesRouter = require('./api/controllers/sales');
const patientAnalytics = require('./api/controllers/patients.controller');
const logger = require("./logger");
const cors = require("cors");


// if (cluster.isMaster) { 
//   console.log(`Master ${process.pid} is running`);
//   // Fork workers.
//   for (let i = 1; i < os.cpus().length; i++) {
//     cluster.fork();
//   }
// } else {
//   console.log(`Worker ${process.pid} started`);
//   app.listen(port, () => {
//     console.log(`listening at http://localhost:${port}`);
//   });
// }


app.listen(port, () => {
  console.log(`listening at http://localhost:${port}`);
});


const { promisifyQuery, customError } = require("./helper");
app.use( cors({origin: "*",credentials: false}));
app.use(express.static('public'))



// manage with cors
// manage with body-parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));




// ensuring an acess token is present
// app.use((req, res, next) => {
//   if (req.url == '/api/v1/register') {
//     next();
//   } else {
//    new User().validateRequestToken(req, res, next, process.env.ACCESS_TOKEN_SECRET)
//   }
// })


// api endpoints

app.use(Manager)
app.use(organizationRouter);
app.use(emailRouterController);
app.use(LoginsRouter);
app.use(ChemistryRoutes);
app.use(phelobotomyRouter);
app.use(rejectedRouter);
app.use(supplyRouter);
app.use(settingsRouter);
app.use(operationsRouter);
app.use(resultprintRouter)
app.use(resultChecker);
app.use(clinicianRouter);
app.use(generalSalesRouter);
app.use(branchesHandler);
app.use(registrationRouter);
app.use(applicationsettingsRouter);
app.use(stocksRouter);
app.use(patientAnalytics);

app.get("/", (req, res) => {
  res.status(200).json({ message: "success" });
});

app.get('/api/v1/authenticate/employee/token', async function (request, response) {
  new User().validateEmployeeToken(request, response);
})

app.post("/api/v1/billing", async (req, res) => {
  const { patientid, clinician, organization, test, payable, testcost, paid, taxIncluded, taxValue, status, discount, paymentmode, samplingCenter, outstanding, cost } = req.body;

  const billing = new Billing(patientid, clinician, organization, test, payable, testcost, paid, taxIncluded, taxValue, status, discount, paymentmode, samplingCenter, outstanding, cost);

  const result = await billing.insertionProcess(req, res);
  
  typeof result === "string" && customError(result, 400, res);
  typeof result === "number" && response.status(200).json({ message: 'billing successfully', billingid: result, statusCode: 200, status: 'success' }); 
  typeof result === "boolean" && result === false && customError("something wrong occured adding new billing", 404, res);

});

app.get("/api/v1/billedclients", (req, res) => {
  getBilledClients(req, res);
});


app.get("/api/v1/billing", function (request, response) {
  getClientBillingInformation(request, response);
});

app.put("/api/v1/billing", function (request, response) {
  updateBilling(request, response);
});

// sample api endpoint

app.get("/api/v1/sample", function (request, response) {
  let sampleHandle = new SampleHandler(request, response);
  sampleHandle.getCollectedSamples();
});

app.put("/api/v1/sample", function (request, response) {
  const  sampleHandle = new SampleHandler( request,response);
  sampleHandle.updateRecords(request, response);
});







app.get("/api/v1/activation", (req, res) => {
  const Keys = Object.keys(req.query);
  if (Keys.includes("action") && Keys.includes("patientid")) {
    activation.activateDeactivate(req, res);
  } else {
    activation.getPartialData(req, res);
  }
});


app.get("/api/v1/activation/bulk", (req, res) => {
  activation.activateDeactivate(req, res)
})

app.get("/api/v1/testpanel/categories", (req, res) => {
  getCategory(req, res);
});


app.post("/api/v1/testpanel/categories", (req, res) => {
  postCategory(req, res);
});

app.get("/api/v1/center", (req, res) => {
  get(req, res);
});

app.get("/api/v1/testpanel/list", (req, res) => {
  testpanel.getPanels(req, res);
});
app.get("/api/v1/testpanel/list/bulk", (req, res) => {
  testpanel.getpanelsbulk(req, res);
});

app.post('/api/v1/testpanel/bulkupdate', (request, response) => {
  testpanel.bulkTestUpdate(request, response)
})


app.get('/api/v1/testpanel/list/update', async function (req, res) {
  const { billingid } = req.query;
  if (billingid) {
    try {
      const insertion = `SELECT * FROM test_panels AS tp  INNER JOIN
     test_ascension AS ta ON  ta.testid = tp.ID WHERE ta.billingid = ?`
      const result = await promisifyQuery(insertion, billingid);
      res.send({ message: 'success', statusCode: 200, result })
    }
    catch (err) {
      logger.error(err);
      console.log(err)
    }
  }
  else {
    res.send({
      statusCode: 401,
      status: 'billing id required',
      message: 'include billing in the request header as a query'
    })
  }
})

app.post("/api/v1/testpanel/list", (req, res) => {
  testpanel.postPanel(req, res);
});

app.put('/api/v1/testpanel/list', function (request, response) {
  testpanel.putSingleTestPanel(request, response);
})

app.delete("/api/v1/testpanel/list", (req, res) => {
  testpanel.deletePanel(req, res);
});









