"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const route_1 = __importDefault(require("./controllers/applicationsettings/branches/route"));
const route_2 = __importDefault(require("./controllers/result/route"));
const route_3 = __importDefault(require("./controllers/operations/route"));
const route_4 = __importDefault(require("./controllers/registration/route"));
const route_5 = __importDefault(require("./controllers/samples/rejected/route"));
const route_6 = __importDefault(require("./controllers/clinicians/route"));
const drugsRouter_1 = __importDefault(require("./controllers/drugs/drugsRouter"));
const route_7 = __importDefault(require("./controllers/sms/route"));
const route_8 = __importDefault(require("./controllers/settings/route"));
const route_9 = __importDefault(require("./controllers/logins/route"));
const routes_1 = __importDefault(require("./controllers/insurance/routes"));
const routes_2 = __importDefault(require("./controllers/printables/routes"));
const route_10 = __importDefault(require("./controllers/organization/route"));
const route_11 = __importDefault(require("./controllers/applicationsettings/route"));
const route_12 = __importDefault(require("./controllers/sales/route"));
const route_13 = __importDefault(require("./controllers/billing/sales/route"));
const route_14 = __importDefault(require("./controllers/medicalRecords/route"));
const index_1 = __importDefault(require("./controllers/billing/index"));
const routes_3 = __importDefault(require("./controllers/testpanel/routes"));
const route_15 = __importDefault(require("./controllers/expenses/route"));
const route_16 = __importDefault(require("./controllers/security/route"));
const appointment_1 = __importDefault(require("./controllers/appointments/appointment"));
const packages_1 = __importDefault(require("./controllers/billing/packages/packages"));
const clinicians_analytics_routes_1 = __importDefault(require("./controllers/analytics/clinicians-analytics/clinicians-analytics-routes"));
const attendancerouters_1 = __importDefault(require("./controllers/appointments/attendancerouters"));
const route_17 = __importDefault(require("./controllers/customers/route"));
const routes_4 = __importDefault(require("./controllers/analytics/test-ascension-analytics/routes"));
const sampleContainerRoutes_1 = __importDefault(require("./controllers/routes/sampleContainerRoutes"));
const uploadController_1 = __importDefault(require("./controllers/uploads/uploadController"));
const routes_5 = __importDefault(require("./controllers/registration/patient/routes"));
const expenses_analytics_route_1 = __importDefault(require("./controllers/analytics/Expenses-analytics/expenses-analytics-route"));
const qualityControlRoutes_1 = __importDefault(require("./controllers/QualityControl/qualityControlRoutes"));
const excelparserHandler_1 = __importDefault(require("./controllers/utilities/excelparserHandler"));
// ANALYTICS 
const patient_analytics_route_1 = __importDefault(require("./controllers/analytics/patient-analytics/patient-analytics-route"));
const validateTenancy_1 = require("./middleware/validateTenancy");
const routes_6 = __importDefault(require("./controllers/sms/primesms/routes"));
const route_18 = __importDefault(require("./controllers/analytics/sms-analytics/route"));
const app = (0, express_1.default)();
const port = process.env.NODE_ENV === "development"
    ? process.env.DEVELOPMENT_PORT
    : process.env.PRODUCTION_PORT;
app.use((0, cors_1.default)({ origin: "*", credentials: true, preflightContinue: false }));
app.use(express_1.default.static("public"));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// app.use(checkTokenExists);
app.use(validateTenancy_1.ValidateTenancyAgreement);
app.use(route_18.default);
app.use(route_16.default);
app.use(index_1.default);
app.use(sampleContainerRoutes_1.default);
app.use(routes_3.default);
app.use(route_15.default);
app.use(route_10.default);
app.use(appointment_1.default);
app.use(uploadController_1.default);
app.use(route_9.default);
app.use(drugsRouter_1.default);
app.use(route_5.default);
app.use(route_13.default);
app.use(route_14.default);
app.use(route_8.default);
app.use(route_3.default);
app.use(routes_2.default);
app.use(route_2.default);
app.use(route_6.default);
app.use(routes_1.default);
app.use(route_7.default);
app.use(route_12.default);
app.use(route_1.default);
app.use(route_4.default);
app.use(route_11.default);
app.use(route_17.default);
app.use(route_16.default);
app.use(routes_4.default);
app.use(attendancerouters_1.default);
app.use(packages_1.default);
app.use(clinicians_analytics_routes_1.default);
app.use(routes_5.default);
app.use(patient_analytics_route_1.default);
app.use(expenses_analytics_route_1.default);
app.use(qualityControlRoutes_1.default);
app.use(routes_6.default);
app.use(excelparserHandler_1.default);
app.get("/", (req, res) => {
    res.status(200).json({ message: "success" });
});
app.post('/devices', (req, res) => {
    console.log('RECEIVED DATA -------------------------------------------');
    console.log(req.body);
    res.status(200).json({ status: 'okay' });
    console.log('RECEIVED DATA -------------------------------------------');
});
// ApplicationSettings.getLabRegionalAndDistrictCodeAbbreviations(3)
app.listen(5000, async (err) => {
    try {
        // const security = new Security(null, null);
        // const isLicensed = await security.environmentSecurity(__dirname);
        // if (!isLicensed) process.exit();
        // createSchema(3,'./src/database', 'DatabaseTableSchema.ts')
        // if (new Date() > configuration['EXPIRYDATE']) {
        // 	console.log('Application is expired')
        // 	process.exit(0)
        // }
        // )
        // const currentYear = new Date().getFullYear();
        // new PartitionManager('billing','billing').addYearPartition(3, currentYear);
        // new PartitionManager('test_ascension','asc').addYearPartition(3, currentYear);
        // new BillingMultiSteps(3,32,2).processTransaction().then((id) => {
        // 	console.log(id)
        // 	})
        // const d = await new PrimeEventsSMSDataSource(3).organizationRegistrationEvent(3, 1);
        // console.log(d)
        // const e = await new PrimeEventsSMSDataSource(3).paymentConfirmationEvent(3, 211	);
        // console.log(e)
        // const deviceManager = new DeviceManager();
        // await deviceManager.initialize();
        // // Wait for server to be fully initialized
        // await new Promise(resolve => setTimeout(resolve, 1000));
        // // Then start the test client
        // const testClient = new TestHL7Client('localhost', 6668);
        // testClient.connect();
        console.log(`connected to port 5000`);
    }
    catch (err) {
        console.log(err);
    }
});
