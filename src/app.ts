import "reflect-metadata";
import express, { Request, Response } from "express";
import cors from "cors";
import os from 'os';
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
import qualityControlRoutes from './controllers/QualityControl/qualityControlRoutes';
import ExcelParser from './controllers/utilities/excelparserHandler';
import OutsourcedTestTracking from './controllers/analytics/outsourcedTestTracking.routes'
import InventoryRouter from './controllers/inventory/routes/index';
// ANALYTICS 
import PatientAnalytics from './controllers/analytics/patient-analytics/patient-analytics-route';
import { checkTokenExists, ValidateTenancyAgreement } from "./middleware/validateTenancy";
import requestLogger from "./middleware/requestLogger";
import smsPrimeRouter from './controllers/sms/primesms/routes';
import smsAnalytics from './controllers/analytics/sms-analytics/route';
import InterfacingDevicesRouter from "./controllers/settings/devices/route";
import complianceRouter from './controllers/compliance/routes';
import { killProcessOnPort } from "./models/security/killport";
import logger from './hooks/logger';
import CommissionPaymentsRouter from './controllers/commission/index';
import leadsRouter from './controllers/crm/leads/route';
import followupsRouter from './controllers/crm/leads/followups.route';
import payrollRouter from './controllers/payroll/routes';
import freeServicesRouter from './controllers/billing/FreeServices/routes';
import commissionConfigRouter from './models/commissions/commission-configurations/controllers/routes';
import emailRouter from './controllers/email/route';
import notificationsRouter from './controllers/notifications/route';
import { bootstrapNotificationDefinitions } from './models/application/notifications/services/NotificationBootstrapService';
import DeviceModelsVersionProcessing from "./controllers/settings/devices/DeviceDataProcessing";
import InterfacingDevicesRouterT from "./routes/settings/devices/medicalInterfacingDevicesRoute";
import employeeSettingsRouter from './models/settings/users/routes/employeeSettingsRoutes';
import { bootstrapHomeCollectionSeeds, bootstrapHomeCollectionTables } from "./models/operations/sample/HomeCollection/BootstrapHomeCollection";
import { bootstrapCommissionTables } from './models/commissions/commission-configurations/services/CommissionBootstrapService';
import { bootstrapBillingTables } from './models/billing/BillingTableBootstrapper';



const app = express();
const port = process.env.NODE_ENV === "development" ? process.env.DEVELOPMENT_PORT : process.env.PRODUCTION_PORT;


app.use(cors({
    origin: function (origin, callback) {
        callback(null, origin || false);
    },
    credentials: true,
    preflightContinue: false
}));

app.use(express.static("public"));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(requestLogger);
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
app.use(qualityControlRoutes);
app.use(smsPrimeRouter);
app.use(ExcelParser);
app.use(InterfacingDevicesRouter)
app.use(complianceRouter)
app.use('/api/v1/inventory', InventoryRouter);
app.use(CommissionPaymentsRouter);
app.use('/api/v1/leads', leadsRouter);
app.use('/api/v1/followups', followupsRouter);
app.use('/api/v1/payroll', payrollRouter);
app.use('/api/v1/billing/free-services', freeServicesRouter);
app.use('/api/v1/commission', commissionConfigRouter);
app.use(emailRouter);
app.use(notificationsRouter);
app.use(employeeSettingsRouter);
app.use(InterfacingDevicesRouterT);


app.get("/", (req: Request, res: Response) => {
    res.status(200)
        .json({
            message: "success",
            status: "Healthy"
        });
});


app.listen(Number(port), "0.0.0.0", async () => {
    const pid = process.pid;

    const timestamp = new Date().toLocaleString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
    });

    const localUrl = `http://localhost:${port}`;
    const networkUrl = `http://${os.hostname()}:${port}`;

    console.log(
        `\x1b[32m[PrimeLabSys]\x1b[0m ${pid}  - ${timestamp}     \x1b[32mLOG\x1b[0m \x1b[38;5;39m[Bootstrap]\x1b[0m Application successfully started`
    );

    console.log(
        `\x1b[32m[PrimeLabSys]\x1b[0m ${pid}  - ${timestamp}     \x1b[32mLOG\x1b[0m \x1b[38;5;39m[Bootstrap]\x1b[0m Environment : ${process.env.NODE_ENV ?? "development"}`
    );

    console.log(
        `\x1b[32m[PrimeLabSys]\x1b[0m ${pid}  - ${timestamp}     \x1b[32mLOG\x1b[0m \x1b[38;5;39m[Bootstrap]\x1b[0m Port        : ${port}`
    );

    console.log(
        `\x1b[32m[PrimeLabSys]\x1b[0m ${pid}  - ${timestamp}     \x1b[32mLOG\x1b[0m \x1b[38;5;39m[Bootstrap]\x1b[0m Local       : ${localUrl}`
    );

    console.log(
        `\x1b[32m[PrimeLabSys]\x1b[0m ${pid}  - ${timestamp}     \x1b[32mLOG\x1b[0m \x1b[38;5;39m[Bootstrap]\x1b[0m Network     : ${networkUrl}`
    );

    await bootstrapBillingTables(1)
    await bootstrapCommissionTables(1)
    await bootstrapNotificationDefinitions(1)
    await bootstrapHomeCollectionTables(1)
    await bootstrapHomeCollectionSeeds(1)

    //     logger.info("Server startup successful", {
    //         port: Number(port),
    //         environment: process.env.NODE_ENV,
    //         pid,
    //         addresses: {
    //             local: localUrl,
    //             network: networkUrl,
    //         },
    //     });
});



