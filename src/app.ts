import express, { Request, Response } from "express";
import cors from "cors";
import branchesHandler from "./controllers/applicationsettings/branches/route";
import resultChecker from "./controllers/result/route";
import operationsRouter from "./controllers/operations/route";
import registrationRouter from "./controllers/registration/route";
import rejectedRouter from "./controllers/samples/rejected/route";
import clinicianRouter from "./controllers/clinicians/route";
import drugsRouter from "./controllers/drugs/drugsRouter";
import SMSRouter from "./controllers/sms/route";
import settingsRouter from "./controllers/settings/route";
import LoginsRouter from "./controllers/logins/route";
import insuranceRouters from './controllers/insurance/routes'
import resultprintRouter from "./controllers/printables/routes";
import organizationRouter from "./controllers/organization/route";
import applicationsettingsRouter from "./controllers/applicationsettings/route";
import generalSalesRouter from "./controllers/sales/route";
import FinancialAnalyticsPrimeLabSystemRouter from "./controllers/billing/sales/route";
import MedicalRecordHandler from './controllers/medicalRecords/route';
import BillingRouter from "./controllers/billing/index";
import testPanelRouter from "./controllers/testpanel/routes";
import expenseRouter from "./controllers/expenses/route";
import SecurityRouter from "./controllers/security/route";
import AppointmentRouter from "./controllers/appointments/appointment";
import BillingPackages from './controllers/billing/packages/packages';
import ClinicianAnalyticsRouter from './controllers/analytics/clinicians-analytics/clinicians-analytics-routes'
import AttendanceRouter from './controllers/appointments/attendancerouters'
import customerRouter from "./controllers/customers/route";
import TestAscensionAnalytics from './controllers/analytics/test-ascension-analytics/routes'
import sampleContainerRouter from "./controllers/routes/sampleContainerRoutes";
import FileUploadsRouter from './controllers/uploads/uploadController';
import IndividualPatientAnalyticRouter from './controllers/registration/patient/routes';
import ExpensesAnalyticsRouter from './controllers/analytics/Expenses-analytics/expenses-analytics-route';
import { DeviceManager } from './services/medical-devices/DeviceManager';
import { TestHL7Client } from './services/medical-devices/TestHL7Client';
import qualityControlRoutes from './controllers/QualityControl/qualityControlRoutes';
import AdvancedBillingRouter from './controllers/billing/AdvancedBillingStrategy/route';

// ANALYTICS 
import PatientAnalytics from './controllers/analytics/patient-analytics/patient-analytics-route';
import { PrimeSmsServices } from "./models/application/sms/smsClass";
import { TenancyRepository } from "./models/Tenancy/tenancyRepo";
import { primeTenancyConnector } from "./models/Tenancy/tenantConnections";
import { checkTokenExists, ValidateTenancyAgreement } from "./middleware/validateTenancy";
import ApplicationSettings from "./models/application/appsettings/appset";
import { createSchema } from "./database/createTableSchema";
import { configuration } from "./hooks/configuration";
import PartitionManager from "./models/billing/partitioning";
import { PanelRunner } from "./migrations/data/SeedTestPanels/panelRunner";
import EventsExecutor from "./models/application/sms/events/EventsExecutor";
import ExpenseAuditLog from "./models/Expenses/ExpenseAuditLog";
import ExpensesAnalytics from "./models/analytics/ExpensesAnalytics/Expenses-Analytics";
import smsPrimeRouter from './models/application/sms/controllers/routes';



const app = express();
const port = process.env.NODE_ENV === "development"
	? process.env.DEVELOPMENT_PORT
	: process.env.PRODUCTION_PORT;

app.use(cors({ origin: "*", credentials: true, preflightContinue: false }));
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// app.use(checkTokenExists);
app.use(ValidateTenancyAgreement)
app.use(SecurityRouter);
app.use(BillingRouter);
app.use(sampleContainerRouter);
app.use(testPanelRouter);
app.use(expenseRouter);
app.use(organizationRouter);
app.use(AppointmentRouter);
app.use(FileUploadsRouter);
app.use(LoginsRouter);
app.use(drugsRouter);
app.use(rejectedRouter);
app.use(FinancialAnalyticsPrimeLabSystemRouter);
app.use(MedicalRecordHandler);
app.use(settingsRouter);
app.use(operationsRouter);
app.use(resultprintRouter);
app.use(resultChecker);
app.use(clinicianRouter);
app.use(insuranceRouters);
app.use(SMSRouter);
app.use(generalSalesRouter);
app.use(branchesHandler);
app.use(registrationRouter);
app.use(applicationsettingsRouter);
app.use(customerRouter);
app.use(SecurityRouter);
app.use(TestAscensionAnalytics)
app.use(AttendanceRouter);
app.use(BillingPackages);
app.use(ClinicianAnalyticsRouter);
app.use(IndividualPatientAnalyticRouter);
app.use(PatientAnalytics);
app.use(ExpensesAnalyticsRouter);
app.use(qualityControlRoutes);
app.use(AdvancedBillingRouter);
app.use(smsPrimeRouter);


app.get("/", (req: Request, res: Response) => {
	res.status(200).json({ message: "success" });
});



app.post(
	'/devices', (req, res) => {
		console.log('RECEIVED DATA -------------------------------------------')
		console.log(req.body)
		res.status(200).json({ status: 'okay' })
		console.log('RECEIVED DATA -------------------------------------------')
	}
)



// ApplicationSettings.getLabRegionalAndDistrictCodeAbbreviations(3)



app.listen(5000, async (err?: Error) => {
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
		// const deviceManager = new DeviceManager();
		// await deviceManager.initialize();

		// // Wait for server to be fully initialized
		// await new Promise(resolve => setTimeout(resolve, 1000));

		// // Then start the test client
		// const testClient = new TestHL7Client('localhost', 6668);
		// testClient.connect();


		console.log(`connected to port 5000`);
	} catch (err) {
		console.log(err)
	}
});

