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
import qualityControlRoutes from './controllers/QualityControl/qualityControlRoutes';
import ExcelParser from './controllers/utilities/excelparserHandler';
import OutsourcedTestTracking from './controllers/analytics/outsourcedTestTracking.routes'

// ANALYTICS 
import PatientAnalytics from './controllers/analytics/patient-analytics/patient-analytics-route';
import { checkTokenExists, ValidateTenancyAgreement } from "./middleware/validateTenancy";
import smsPrimeRouter from './controllers/sms/primesms/routes';
import smsAnalytics from './controllers/analytics/sms-analytics/route';
import InterfacingDevicesRouter from "./routes/settings/devices/medicalInterfacingDevicesRoute";



const app = express();
const port = process.env.NODE_ENV === "development"
	? process.env.DEVELOPMENT_PORT
	: process.env.PRODUCTION_PORT;


app.use(cors({
	origin: function (origin, callback) {
		callback(null, origin || false);
	},
	credentials: true,
	preflightContinue: false
}));

app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(ValidateTenancyAgreement)
// app.use(checkTokenExists)
app.use(OutsourcedTestTracking)
app.use(smsAnalytics);
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
app.use(smsAnalytics);
app.use(BillingRouter);
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
app.use(smsPrimeRouter);
app.use(ExcelParser);
app.use(InterfacingDevicesRouter)





app.get("/", (req: Request, res: Response) => {
	res.status(200).json({ message: "success" });
});



app.listen(port, async (err?: Error) => {
	console.log(`Server is running on port http://localhost:${port}`);
});

