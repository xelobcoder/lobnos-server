import { assertStorageEncryption } from "./security/storageEncryption";
import { configureTransport, applicationServer } from "./security/transport";
import { practitionerBoundary } from "./middleware/practitionerBoundary";
import { consultationRouter, publicPractitionerRouter } from "./controllers/consultation/routes";
import "reflect-metadata";
import operationalControlRoutes from "./controllers/operations/operationalControlRoutes";
import { labAssignmentAccess } from "./middleware/labAssignmentAccess";
import acquisitionRoutes from "./controllers/crm/acquisitionRoutes";
import { signedLicenseGuard } from "./licensing/policy";
import licenseRoutes from "./controllers/security/licenseRoutes";
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
import { startSmsContactGroupWorker } from "./models/application/sms/SmsContactGroupWorker";
import { startCriticalReadbackWorker } from "./models/operations/CriticalReadbackWorker";
import { recordSmsDelivery, startSmsCampaignWorker } from "./models/application/sms/SmsCampaignWorker";
import { smsAuthority } from "./middleware/smsAuthority";
import { financialDayLimit, financialDayReadinessHandler } from "./middleware/financialDayLimit";
import financialLockSettingsRouter from "./middleware/financialLockSettings";
import settingsRouter from "./controllers/settings/route";
import LoginsRouter from "./controllers/logins/route";
import insuranceRouters from "./controllers/insurance/routes";
import resultprintRouter from "./controllers/printables/routes";
import organizationRouter from "./controllers/organization/route";
import organizationInvoiceRouter from "./controllers/organization/organizationInvoiceRoutes";
import applicationsettingsRouter from "./controllers/applicationsettings/route";
import generalSalesRouter from "./controllers/sales/route";
import FinancialAnalyticsPrimeLabSystemRouter from "./controllers/billing/sales/route";
import MedicalRecordHandler from "./controllers/medicalRecords/route";
import BillingRouter from "./controllers/billing/index";
import testPanelRouter from "./controllers/testpanel/routes";
import expenseRouter from "./controllers/expenses/route";
import { blockPublicExpenseReceipts } from "./middleware/expenseIdentity";
import SecurityRouter from "./controllers/security/route";
import AppointmentRouter from "./controllers/appointments/appointment";
import BillingPackages from "./controllers/billing/packages/packages";
import ClinicianAnalyticsRouter from "./controllers/analytics/clinicians-analytics/clinicians-analytics-routes";
import AttendanceRouter from "./controllers/appointments/attendancerouters";
import customerRouter from "./controllers/customers/route";
import TestAscensionAnalytics from "./controllers/analytics/test-ascension-analytics/routes";
import sampleContainerRouter from "./controllers/routes/sampleContainerRoutes";
import FileUploadsRouter from "./controllers/uploads/uploadController";
import { blockPublicPatientImages } from "./models/uploads/fileuploads";
import IndividualPatientAnalyticRouter from "./controllers/registration/patient/routes";
import qualityControlRoutes from "./controllers/QualityControl/qualityControlRoutes";
import ExcelParser from "./controllers/utilities/excelparserHandler";
import OutsourcedTestTracking from "./controllers/analytics/outsourcedTestTracking.routes";
import InventoryRouter from "./controllers/inventory/routes/index";
import pharmacyRouter from "./controllers/pharmacy/routes";
import prescriptionRouter from "./controllers/prescriptions/routes";
import entityOrdersRouter from "./controllers/entityorders/routes";
import homeCollectionRouter from "./controllers/operations/homeCollection/routes";
// ANALYTICS
import PatientAnalytics from "./controllers/analytics/patient-analytics/patient-analytics-route";
import { checkTokenExists, ValidateTenancyAgreement } from "./middleware/validateTenancy";
import { patientPortalRouter, publicPatientPortalRouter } from "./controllers/patient-portal/route";
import { clinicianPortalRouter } from "./controllers/clinician-portal/route";
import { facilityModuleAccess } from "./middleware/facilityModuleAccess";
import masterAuthRouter from "./controllers/platform/masterAuth";
import platformFacilitiesRouter from "./controllers/platform/facilities";
import {
     createPaymentWebhookRouter,
     createPlatformPaymentsRouter,
     createTenantPaymentsRouter,
     getPaymentGatewayService,
} from "./payments/paymentRoutes";
import { startPaymentReconciliationWorker } from "./payments/PaymentReconciliationWorker";
import publicFacilitiesRouter from "./controllers/public/facilities";
import {
     publicWalkInQueueRouter,
     walkInQueueRouter,
     queuePublicBodyBoundary,
} from "./controllers/queue/WalkInQueueController";
import subscriptionRouter from "./controllers/subscription/route";
import requestLogger from "./middleware/requestLogger";
import smsPrimeRouter from "./controllers/sms/primesms/routes";
import smsAnalytics from "./controllers/analytics/sms-analytics/route";
import InterfacingDevicesRouter from "./controllers/settings/devices/route";
import complianceRouter from "./controllers/compliance/routes";
import CommissionPaymentsRouter from "./controllers/commission/index";
import leadsRouter from "./controllers/crm/leads/route";
import followupsRouter from "./controllers/crm/leads/followups.route";
import payrollRouter from "./controllers/payroll/routes";
import freeServicesRouter from "./controllers/billing/FreeServices/routes";
import commissionConfigRouter from "./models/commissions/commission-configurations/controllers/routes";
import emailRouter from "./controllers/email/route";
import notificationsRouter from "./controllers/notifications/route";
import InterfacingDevicesRouterT from "./routes/settings/devices/medicalInterfacingDevicesRoute";
import employeeSettingsRouter from "./models/settings/users/routes/employeeSettingsRoutes";
import accountingRouter from "./controllers/accounting/route";
import reportsRouter from "./controllers/reports/route";
import staffFocRouter from "./controllers/foc/routes";
import physicalSampleRouter from "./controllers/samples/physicalSampleRoutes";
import { redisConnection } from "./accountingModule/queue/redisConnection";
import { bootstrapTenants, startApplicationBackgroundWorkers } from "./bootstrap/applicationStartup";
import { startPatientPortalWorkers } from "./models/patient-portal/PatientPortalNotifier";
import { startAppointmentReminderWorker } from "./models/appointments/AppointmentReminderWorker";
import { logApplicationStarted } from "./bootstrap/startupLogger";
import marketplaceRouter from "./marketplace/marketplaceRouter";
import { bootstrapMarketplace } from "./marketplace/MarketplaceBootstrapper";
import { pharmacyModuleBoundary } from "./middleware/pharmacyModuleBoundary";

const app = express();
configureTransport(app);
const port = process.env.NODE_ENV === "development" ? process.env.DEVELOPMENT_PORT : process.env.PRODUCTION_PORT;

// Financial, patient and session API responses must never enter a shared CDN cache.
app.use("/api", (_req, res, next) => {
     res.setHeader("Cache-Control", "private, no-store, max-age=0");
     res.setHeader("CDN-Cache-Control", "no-store");
     res.setHeader("Cloudflare-CDN-Cache-Control", "no-store");
     next();
});

app.use(
     cors({
          origin: function (origin, callback) {
               callback(null, origin || false);
          },
          credentials: true,
          preflightContinue: false,
     }),
);

// Parse public kiosk requests before the general API's larger JSON allowance.
app.use("/api/v1/public/queue", ...queuePublicBodyBoundary);
app.use(createPaymentWebhookRouter());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(signedLicenseGuard);
// Recovery is authenticated but not gated by an activated certificate.
app.use(licenseRoutes);
app.use(blockPublicPatientImages);
// Expense evidence is available only through authenticated, tenant-scoped receipt APIs.
app.use(blockPublicExpenseReceipts);
app.use(express.static("public"));
// Marketplace routes validate/reject query strings before the generic request
// logger, keeping tracking credentials, payment references and patient details
// out of access-log URLs.
app.use(marketplaceRouter);
app.use(requestLogger);
app.get("/api/v1/health", (_req: Request, res: Response) => {
     res.statusCode = 200;
     res.end("healthy");
});
// Platform authority derives its tenant from the verified session, not a caller-supplied tenantId.
// The router enforces active control-tenant standing and live super-admin/session validation.
app.use(masterAuthRouter);
app.use(createPlatformPaymentsRouter());
app.use(platformFacilitiesRouter);
app.use(publicFacilitiesRouter);
app.use(publicWalkInQueueRouter);
// Patient portal activation derives the facility from an invitation or public facility identifier.
app.use(publicPatientPortalRouter);
app.use(publicPractitionerRouter);
app.get("/api/v1/sms-delivery/:tenantId/:jobid/:token", async (req, res) => {
     try {
          const accepted = await recordSmsDelivery(
               Number(req.params.tenantId),
               Number(req.params.jobid),
               req.params.token,
               req.query.sms_id,
               req.query.status,
               { query: req.query as any, headers: req.headers as any },
          );
          res.status(accepted ? 200 : 404).json({ accepted });
     } catch {
          res.status(503).json({ error: "Delivery report temporarily unavailable" });
     }
});
app.use(ValidateTenancyAgreement);
app.use(facilityModuleAccess);
app.use(subscriptionRouter);
app.use(checkTokenExists);
app.use(practitionerBoundary);
app.use(pharmacyModuleBoundary);
app.use(labAssignmentAccess);
app.use(smsAuthority);
app.get("/api/v1/financial-day/readiness", financialDayReadinessHandler);
app.use(financialLockSettingsRouter);
app.use(financialDayLimit);
app.use("/api/v1/operations/control", operationalControlRoutes);
app.use("/api/v1/queue", walkInQueueRouter);
app.use(patientPortalRouter);
app.use(consultationRouter);
app.use(createTenantPaymentsRouter());
app.use(clinicianPortalRouter);
app.use(InterfacingDevicesRouterT);
app.use(OutsourcedTestTracking);
app.use(smsAnalytics);
app.use(SecurityRouter);
app.use(BillingRouter);
app.use(sampleContainerRouter);
app.use(testPanelRouter);
app.use(expenseRouter);
app.use(organizationRouter);
app.use(organizationInvoiceRouter);
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
app.use(TestAscensionAnalytics);
app.use(AttendanceRouter);
app.use(BillingPackages);
app.use(ClinicianAnalyticsRouter);
app.use(IndividualPatientAnalyticRouter);
app.use(PatientAnalytics);
app.use(qualityControlRoutes);
app.use(smsPrimeRouter);
app.use(ExcelParser);
app.use(InterfacingDevicesRouter);
app.use(complianceRouter);
app.use("/api/v1/inventory", InventoryRouter);
app.use("/api/v1/pharmacy", pharmacyRouter);
app.use("/api/v1", prescriptionRouter);
app.use(entityOrdersRouter);
app.use(homeCollectionRouter);
app.use(CommissionPaymentsRouter);
app.use("/api/v1/crm", acquisitionRoutes);
app.use("/api/v1/leads", leadsRouter);
app.use("/api/v1/followups", followupsRouter);
app.use("/api/v1/payroll", payrollRouter);
app.use("/api/v1/billing/free-services", freeServicesRouter);
app.use("/api/v1/commission", commissionConfigRouter);
app.use(emailRouter);
app.use(notificationsRouter);
app.use(employeeSettingsRouter);
app.use(accountingRouter);
app.use(reportsRouter);
app.use(staffFocRouter);
app.use("/api/v1/physical-samples", physicalSampleRouter);

app.get("/", (req: Request, res: Response) => {
     res.status(200).json({
          message: "success",
          status: "Healthy",
     });
});

app.get("/api/v1/health/redis", async (_req: Request, res: Response) => {
     try {
          if (redisConnection.status === "wait") {
               await redisConnection.connect();
          }

          const pingResponse = await redisConnection.ping();
          return res.status(200).json({
               status: "success",
               statusCode: 200,
               message: "Redis reachable",
               result: {
                    host: process.env.REDIS_HOST || "127.0.0.1",
                    port: Number(process.env.REDIS_PORT) || 6379,
                    ping: pingResponse,
                    connectionStatus: redisConnection.status,
               },
          });
     } catch (error: any) {
          return res.status(503).json({
               status: "error",
               statusCode: 503,
               message: "Redis unreachable",
               error: error?.message || String(error),
               result: {
                    host: process.env.REDIS_HOST || "127.0.0.1",
                    port: Number(process.env.REDIS_PORT) || 6379,
                    connectionStatus: redisConnection.status,
               },
          });
     }
});

async function startApplication() {
     await assertStorageEncryption();
     const { readyTenants, accountingTenants } = await bootstrapTenants();
     await bootstrapMarketplace();
     if (readyTenants.length === 0) {
          console.error(
               "[Bootstrap] No tenant database could be prepared; logins will fail until a tenant is reachable.",
          );
     }
     const host = process.env.HOST || "0.0.0.0";

     applicationServer(app).listen(Number(port), host, () => {
          logApplicationStarted(port);
          startApplicationBackgroundWorkers(accountingTenants, { accountingReady: accountingTenants.length > 0 });
          startPatientPortalWorkers(readyTenants);
          startAppointmentReminderWorker(readyTenants);
          startSmsCampaignWorker(readyTenants);
          startSmsContactGroupWorker(readyTenants);
          startCriticalReadbackWorker(readyTenants);
          // Tenants hold their own gateway credentials, so recovery must run even when no platform provider is configured.
          startPaymentReconciliationWorker(getPaymentGatewayService());
     });
}

startApplication().catch((error) => {
     console.error("[Bootstrap] Application startup failed:", error);
     process.exit(1);
});
