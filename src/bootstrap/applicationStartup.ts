import { up as bootstrapPatientContacts } from "../cron/command-line-tool-database/migrations/20261115_patient_contact_ownership";
import { up as bootstrapPatientPhoneContacts } from "../cron/command-line-tool-database/migrations/20261116_patient_phone_contacts";
import { up as bootstrapPatientDuplicates } from "../cron/command-line-tool-database/migrations/20261114_patient_duplicate_candidates";
import { ensureTenantCollationDefault, normalizeTenantCollation } from "../database/legacy-upgrade/TenantCollation";
import { processDueRecurringExpenses } from "../accountingModule/services/RecurringExpenseService";
import { consultationDb } from "../models/consultation/ConsultationSchema";
import { bootstrapNhisIdentifiers } from "../models/billing/NhisIdentifiers";
import { bootstrapOperationalControls } from "../models/operations/OperationalControlsBootstrapper";
import { startCrmReminderWorker } from "../models/crm/CrmReminderService";
import { bootstrapCrm } from "../models/crm/CrmBootstrapper";
import { bootstrapOperationsWorkflow } from "../models/operations/OperationsWorkflowBootstrapper";
import { bootstrapNotificationDefinitions } from "../models/application/notifications/services/NotificationBootstrapService";
import {
     bootstrapHomeCollectionSeeds,
     bootstrapHomeCollectionTables,
} from "../models/operations/sample/HomeCollection/BootstrapHomeCollection";
import { bootstrapCommissionTables } from "../models/commissions/commission-configurations/services/CommissionBootstrapService";
import { bootstrapBillingTables } from "../models/billing/BillingTableBootstrapper";
import { bootstrapExpenseCategories } from "../models/Expenses/ExpenseCategoryBootstrapper";
import { bootstrapExpenseWorkflow } from "../models/Expenses/ExpenseWorkflowBootstrapper";
import { bootstrapAccountingTables, processPendingOutbox, startAccountingWorker } from "../accountingModule";
import { bootstrapInAppNotificationTables } from "../models/application/in-app-notifications/InAppNotificationBootstrapper";
import { bootstrapResultValueAnalyticsTables } from "../models/result-value-analytics/ResultValueAnalyticsBootstrapper";
import { bootstrapReportTables } from "../models/reports/ReportBootstrapper";
import { bootstrapResultSafetyTables } from "../models/results/ResultSafetyBootstrapper";
import { bootstrapLoginAccountSchema } from "../models/auth/LoginUsernameBootstrapper";
import { ensureLoginAttemptSecurity } from "../models/auth/LoginAttemptSecurity";
import { ensureStaffAccessSchema } from "../models/auth/StaffAccessSchema";
import KnexConnection from "../database/KnexConnections";
import { ensureOrganizationDirectorySchema } from "../models/organization/OrganizationDirectorySchema";
import { bootstrapPharmacyTables } from "../models/pharmacy/PharmacyBootstrapper";
import { bootstrapInventoryDefaults } from "../models/inventory/InventoryBootstrapper";
import { bootstrapPrescriptionTables } from "../models/prescriptions/PrescriptionBootstrapper";
import { bootstrapEntityOrderTables } from "../models/entityorders/EntityOrderBootstrapper";
import { bootstrapEmailTables } from "../models/application/email/EmailBootstrapper";
import { bootstrapPayrollTables } from "../models/payroll/PayrollBootstrapper";
import {
     bootstrapTestReportSettingsTable,
     ensureTestReportSettingsTable,
} from "../models/application/appsettings/result-settings/TestReportSettingsBootstrapper";
import { bootstrapRefundTableSanitization } from "../models/billing/RefundBootstrapper";
import { bootstrapStaffFocTables } from "../models/foc/StaffFocBootstrapper";
import { bootstrapApplicationSettings } from "../models/application/appsettings/ApplicationSettingsBootstrapper";
import { bootstrapQuickReferralEntities } from "../models/referral/QuickReferralEntityBootstrapper";
import { bootstrapPatientPortal } from "../models/patient-portal/PatientPortalBootstrapper";
import { bootstrapBackupSecuritySettings } from "../models/security/database-backup/BackupSecurityBootstrapper";
import { bootstrapPhysicalSampleTables } from "../models/samples/PhysicalSampleBootstrapper";
import { bootstrapWalkInQueueTables } from "../models/queue/WalkInQueueBootstrapper";
import { bootstrapSuspendedBillingTables } from "../models/billing/SuspendedBillingBootstrapper";
import { bootstrapCalculationAndQcTables } from "../models/creator/calculations/CalculationBootstrapper";
import { up as bootstrapResultSaveSchema } from "../cron/command-line-tool-database/migrations/20261103_result_save_identity";
import { up as bootstrapPharmacyReturnValue } from "../cron/command-line-tool-database/migrations/20261107_pharmacy_return_value";
import { bootstrapAppointmentTables } from "../models/appointments/AppointmentBootstrapper";
import { bootstrapDefaultBranch } from "../models/application/branches/BranchBootstrapper";
import { bootstrapTenantCompanyProfile } from "../models/settings/CompanyProfileBootstrapper";
import { initializeEmptyTenantDatabase } from "../models/Tenancy/EmptyTenantBootstrapper";
import { startOptionalRedisCache } from "../services/cache/testPanelCache";
import { listServedTenants, TenantRegistry, TENANTS_TABLE } from "../models/Tenancy/TenantRegistry";

export { listServedTenants };
import { configuration } from "../hooks/configuration";
import { singleTenantKnexInstance, systemConfigConnection } from "../database/connection";
import logger from "../hooks/logger";
import { bootstrapResultSettings } from "../models/application/appsettings/result-settings/ResultSettingsBootstrapper";
import { bootstrapSmsProviderSettings } from "../models/application/sms/SmsProviderBootstrapper";
import { bootstrapMasterControlDatabase } from "./MasterControlBootstrap";

/** Master test catalog every tenant imports tests from (lives in the master control database). */
const MASTER_CATALOG_TABLES = [
     "test_panels",
     "testdetails",
     "testdetailcategory",
     "testconditions",
     "testcreationrules",
     "sampletype",
     "samplecontainer",
     "departments",
];

export async function verifyMasterCatalog(): Promise<string[]> {
     const missing: string[] = [];
     for (const table of MASTER_CATALOG_TABLES) {
          if (!(await systemConfigConnection.schema.hasTable(table))) missing.push(table);
     }
     if (missing.length > 0) {
          logger.error(
               `[Bootstrap] Master catalog ${configuration.masterControlDatabase} is missing: ${missing.join(", ")}. Run npm run master:merge.`,
          );
     } else {
          logger.info(
               `[Bootstrap] Master catalog ${configuration.masterControlDatabase} ready (${MASTER_CATALOG_TABLES.length} tables)`,
          );
     }
     return missing;
}

/** Prepares every served tenant database. A tenant that cannot be reached is logged and skipped. */
export async function bootstrapTenants(): Promise<{ readyTenants: number[]; accountingTenants: number[] }> {
     await bootstrapMasterControlDatabase();
     await verifyMasterCatalog();
     await TenantRegistry.ensureReady();
     let initializedLocalTenant: { tenantId: number; accountingReady: boolean } | undefined;
     const localRegistration = await new TenantRegistry().getLocalTenantRegistration();
     if (localRegistration?.status === "provisioning"
          && !localRegistration.deletedAt
          && !localRegistration.suspendedAt
          && !localRegistration.archivedAt) {
          await initializeEmptyTenantDatabase(localRegistration);
          const runtime = await runApplicationBootstrappers(localRegistration.tenantId, true, { startWorkers: false });
          if (!runtime.accountingReady) throw new Error("Empty local tenant runtime bootstrap is incomplete");
          const activated = await systemConfigConnection(TENANTS_TABLE)
               .where({ tenant_number: localRegistration.tenantId, status: "provisioning" })
               .update({ status: "active", provisioned_at: systemConfigConnection.fn.now() });
          if (activated !== 1) throw new Error("Empty local tenant could not be activated after initialization");
          TenantRegistry.invalidate();
          initializedLocalTenant = {
               tenantId: localRegistration.tenantId,
               accountingReady: runtime.accountingReady,
          };
          logger.info(
               `[Bootstrap] Empty database initialized and registered as tenant ${localRegistration.tenantId}`,
          );
     }
     await ensureTestReportSettingsTable(singleTenantKnexInstance);
     const readyTenants: number[] = [];
     const accountingTenants: number[] = [];
     for (const tenant of await listServedTenants()) {
          if (initializedLocalTenant?.tenantId === tenant.tenantId) {
               readyTenants.push(tenant.tenantId);
               if (initializedLocalTenant.accountingReady) accountingTenants.push(tenant.tenantId);
               logger.info(
                    `[Bootstrap] Tenant ${tenant.tenantId} (${tenant.facilityCode} - ${tenant.name}) ready on ${tenant.databaseName}`,
               );
               continue;
          }
          try {
               const { accountingReady } = await runApplicationBootstrappers(tenant.tenantId);
               readyTenants.push(tenant.tenantId);
               if (accountingReady) accountingTenants.push(tenant.tenantId);
               logger.info(
                    `[Bootstrap] Tenant ${tenant.tenantId} (${tenant.facilityCode} - ${tenant.name}) ready on ${tenant.databaseName}`,
               );
          } catch (error: any) {
               logger.error(
                    `[Bootstrap] Tenant ${tenant.tenantId} (${tenant.facilityCode}) skipped, database ${tenant.databaseName} unavailable: ${error?.message || error}`,
               );
          }
     }
     return { readyTenants, accountingTenants };
}

export async function runApplicationBootstrappers(
     tenantId = 1,
     strict = false,
     options: { startWorkers?: boolean } = {},
): Promise<{ accountingReady: boolean }> {
     await ensureTenantCollationDefault(await KnexConnection(tenantId));
     await bootstrapTenantCompanyProfile(tenantId);
     await bootstrapDefaultBranch(tenantId);
     if (strict) await normalizeTenantCollation(await KnexConnection(tenantId));
     // Registration must not depend on unrelated module bootstrappers finishing first.
     const patientContactDb = await KnexConnection(tenantId);
     await bootstrapPatientContacts(patientContactDb);
     await bootstrapPatientPhoneContacts(patientContactDb);
     if (!await patientContactDb.schema.hasTable('patient_phone_contacts')) {
          throw new Error('Patient contact schema is unavailable after startup migration');
     }
     await bootstrapLoginAccountSchema(tenantId);
     await ensureLoginAttemptSecurity(await KnexConnection(tenantId));
     await ensureStaffAccessSchema(await KnexConnection(tenantId));
     await ensureOrganizationDirectorySchema(await KnexConnection(tenantId));
     await bootstrapInventoryDefaults(tenantId);
     await bootstrapPharmacyTables(tenantId);
     await bootstrapPharmacyReturnValue(await KnexConnection(tenantId));
     await bootstrapPrescriptionTables(tenantId);
     await bootstrapEntityOrderTables(tenantId);
     await bootstrapBillingTables(tenantId);
     await bootstrapNhisIdentifiers(tenantId);
     await bootstrapCalculationAndQcTables(tenantId);
     await bootstrapResultSaveSchema(await KnexConnection(tenantId));
     await bootstrapOperationsWorkflow(tenantId);
     await bootstrapOperationalControls(tenantId);
     await consultationDb(tenantId);
     await bootstrapSuspendedBillingTables(tenantId);
     await bootstrapPhysicalSampleTables(tenantId);
     await bootstrapWalkInQueueTables(tenantId);
     await bootstrapRefundTableSanitization(tenantId, strict);
     await bootstrapStaffFocTables(tenantId, strict);
     await bootstrapCommissionTables(tenantId);
     await bootstrapCrm(tenantId);
     await bootstrapExpenseCategories(tenantId);
     await bootstrapExpenseWorkflow(tenantId);
     await bootstrapPayrollTables(tenantId);
     await bootstrapNotificationDefinitions(tenantId);
     await bootstrapInAppNotificationTables(tenantId);
     await bootstrapEmailTables(tenantId);
     await bootstrapSmsProviderSettings(tenantId);
     await bootstrapResultValueAnalyticsTables(tenantId, strict);
     await bootstrapReportTables(tenantId);
     await bootstrapResultSafetyTables(tenantId);
     await bootstrapTestReportSettingsTable(tenantId);
     await bootstrapResultSettings(tenantId);
     await bootstrapApplicationSettings(tenantId);
     await bootstrapBackupSecuritySettings(tenantId);
     await bootstrapQuickReferralEntities(tenantId);
     await bootstrapHomeCollectionTables(tenantId);
     await bootstrapAppointmentTables(tenantId);
     await bootstrapPatientPortal(tenantId);
     await bootstrapPatientDuplicates(await KnexConnection(tenantId));
     // Legacy seeds create checklist rows for demo order 1, not reference data.
     // A new facility must start with no home-collection transactions.
     if (!strict) await bootstrapHomeCollectionSeeds(tenantId);

     let accountingReady = false;

     try {
          await bootstrapAccountingTables(tenantId);
          accountingReady = true;
     } catch (error) {
          if (strict) throw error;
          console.error("[Bootstrap] Accounting module bootstrap failed (isolated, non-fatal):", error);
     }

     // Bootstrappers can add tables after the initial conversion. Gate maintenance/provisioning completion on the final schema.
     if (strict) await normalizeTenantCollation(await KnexConnection(tenantId));
     if (options.startWorkers !== false) startCrmReminderWorker(tenantId);
     return { accountingReady };
}

export function startApplicationBackgroundWorkers(tenantIds: number[], options: { accountingReady: boolean }): void {
     startOptionalRedisCache();
     if (!options.accountingReady || tenantIds.length === 0) return;

     try {
          startAccountingWorker();
     } catch (error) {
          console.error("[Bootstrap] Accounting worker failed to start (isolated, non-fatal):", error);
     }

     const sweep = (label: string) => {
          for (const tenantId of tenantIds) {
               processDueRecurringExpenses(tenantId).catch((error) =>
                    console.error(`[Accounting] recurring expense sweep failed for tenant ${tenantId}:`, error),
               );
               processPendingOutbox(tenantId).catch((error) => {
                    console.error(`[Accounting] ${label} outbox sweep failed for tenant ${tenantId}:`, error);
               });
          }
     };
     sweep("Initial");
     setInterval(() => sweep("Periodic"), 15_000);
}
