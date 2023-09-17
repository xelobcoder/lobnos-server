const express = require("express");
const connection = require('./api/db')
const app = express();
const dotenv = require("dotenv");
const port = 5000;
const {
  addBilling,
  addperformingTest,
  checkifActivated,
  getBilledClients,
  updateBilling,
} = require("./api/billing");
const branchesHandler = require("./api/branches");
const resultChecker = require("./api/controllers/results");
const Manager = require('./api/controllers/manager');
const operationsRouter = require("./api/controllers/operations");
const { getOrganizations } = require("./api/models/organization");
const registrationRouter = require('./api/controllers/registration');
const rejectedRouter = require("./api/controllers/rejected");
const activation = require("./api/activation");
const {
  getCategory,
  putCategory,
  deleteCategory,
  postCategory,
} = require("./api/testpanel/categories");
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
dotenv.config();
const generalSalesRouter = require('./api/controllers/sales');
const cookieSession = require('cookie-session');
const patientAnalytics = require('./api/controllers/patients.controller');




const cors = require("cors");
const logger = require("./logger");
app.use(
  cors({
    origin: "*",
    credentials: false
  })
);


app.listen(port, () => {
  console.log(`listening at http://localhost:${port}`);
});

app.use(cookieSession({
  name: 'x-auth-token', maxAge: 24 * 60 * 60 * 1000, httpOnly: false, keys: ['hwooooooo']
}))

// manage with cors
// manage with body-parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));




// ensuring an acess token is present
// app.use((req, res, next) => {
//   console.log(req.headers)
//   if (req.url == '/api/v1/register') {
//     next();
//   } else {
//     new User().validateRequestToken(req, res, next, process.env.ACCESS_TOKEN_SECRET)
//   }
// })


// api endpoints
app.use(Manager)
app.use(organizationRouter)
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
app.use(patientAnalytics);

app.get("/", (req, res) => {
  res.status(200).json({ message: "success" });
});

//

app.post("/api/v1/billing", (req, res) => {
  addBilling(req, res);
});

app.get("/api/v1/billedclients", (req, res) => {
  getBilledClients(req, res);
});

app.get("/api/v1/billing", function (request, response) {
  checkifActivated(request, response);
});

app.put("/api/v1/billing", function (request, response) {
  updateBilling(request, response);
});

// sample api endpoint

app.get("/api/v1/sample", function (request, response) {
  let sampleHandle = new SampleHandler(
    request.query.status,
    new Date(),
    request,
    response
  );
  const { status, date } = request.query;

  if (!status && !date) {
    sampleHandle.getRecords();
  } else {
    if (status && !date) {
      sampleHandle.getStatus(status);
    } else if (!status && date) {
      sampleHandle.getDate(date);
    } else {
      sampleHandle.getSelectedStutusAndDate(date, status);
    }
  }
});

app.put("/api/v1/sample", function (request, response) {
  let sampleHandle = new SampleHandler(
    request.query.status,
    new Date(),
    request,
    response
  );
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

app.post('/api/v1/testpanel/bulkupdate', (request, response) => {
  testpanel.bulkTestUpdate(request, response)
})


app.get('/api/v1/testpanel/list/update', function (req, res) {
  const { billingid } = req.query;
  if (billingid) {
    try {
      const insertion = `SELECT * FROM test_panels AS tp  INNER JOIN
     test_ascension AS ta ON  ta.testid = tp.ID WHERE ta.billingid = ${billingid}`
      connection.query(insertion, billingid, (err, result) => {
        if (err) { logger.error(err) }
        if (result) {
          res.send({
            result: result.map((i, index) => {
              let dataset = {}
              // rewant to return all result in a pacticular string  format
              // in upper case make suring to return all the result in upper case
              for (key in i) {
                dataset[key.toUpperCase()] = i[key]
              }
              return dataset
            }),
            message: 'success',
            statusCode: 200
          })
        }
      })
    }
    catch (err) {
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

app.get("/api/v1/org", function (req, res) {
  res.send(org);
});


