import { bootstrapNotificationDefinitions } from '../models/application/notifications/services/NotificationBootstrapService';
import { bootstrapHomeCollectionSeeds, bootstrapHomeCollectionTables } from '../models/operations/sample/HomeCollection/BootstrapHomeCollection';
import { bootstrapCommissionTables } from '../models/commissions/commission-configurations/services/CommissionBootstrapService';
import { bootstrapBillingTables } from '../models/billing/BillingTableBootstrapper';
import { bootstrapExpenseCategories } from '../models/Expenses/ExpenseCategoryBootstrapper';
import { bootstrapExpenseWorkflow } from '../models/Expenses/ExpenseWorkflowBootstrapper';
import { bootstrapAccountingTables, processPendingOutbox, startAccountingWorker } from '../accountingModule';
import { bootstrapInAppNotificationTables } from '../models/application/in-app-notifications/InAppNotificationBootstrapper';
import { bootstrapResultValueAnalyticsTables } from '../models/result-value-analytics/ResultValueAnalyticsBootstrapper';
import { bootstrapLoginAccountSchema } from '../models/auth/LoginUsernameBootstrapper';
import { bootstrapPharmacyTables } from '../models/pharmacy/PharmacyBootstrapper';
import { bootstrapInventoryDefaults } from '../models/inventory/InventoryBootstrapper';
import { bootstrapPrescriptionTables } from '../models/prescriptions/PrescriptionBootstrapper';
import { bootstrapEntityOrderTables } from '../models/entityorders/EntityOrderBootstrapper';
import { bootstrapEmailTables } from '../models/application/email/EmailBootstrapper';
import { bootstrapPayrollTables } from '../models/payroll/PayrollBootstrapper';
import { bootstrapTestReportSettingsTable } from '../models/application/appsettings/result-settings/TestReportSettingsBootstrapper';
import { bootstrapRefundTableSanitization } from '../models/billing/RefundBootstrapper';
import { bootstrapStaffFocTables } from '../models/foc/StaffFocBootstrapper';
import { bootstrapApplicationSettings } from '../models/application/appsettings/ApplicationSettingsBootstrapper';
import { bootstrapPhysicalSampleTables } from '../models/samples/PhysicalSampleBootstrapper';
import { bootstrapSuspendedBillingTables } from '../models/billing/SuspendedBillingBootstrapper';
import { bootstrapCalculationAndQcTables } from '../models/creator/calculations/CalculationBootstrapper';
import { bootstrapAppointmentTables } from '../models/appointments/AppointmentBootstrapper';
import { startOptionalRedisCache } from '../services/cache/testPanelCache';
import { listServedTenants } from '../models/Tenancy/TenantRegistry';

export { listServedTenants };
import { configuration } from '../hooks/configuration';
import { systemConfigConnection } from '../database/connection';
import logger from '../hooks/logger';
import { bootstrapResultSettings } from '../models/application/appsettings/result-settings/ResultSettingsBootstrapper';

/** Master test catalog every tenant imports tests from (lives in the master control database). */
const MASTER_CATALOG_TABLES = ['test_panels', 'testdetails', 'testdetailcategory', 'testconditions', 'testcreationrules', 'sampletype', 'samplecontainer', 'departments'];

export async function verifyMasterCatalog(): Promise<string[]> {
	const missing: string[] = [];
	for (const table of MASTER_CATALOG_TABLES) {
		if (!(await systemConfigConnection.schema.hasTable(table))) missing.push(table);
	}
	if (missing.length > 0) {
		logger.error(`[Bootstrap] Master catalog ${configuration.masterControlDatabase} is missing: ${missing.join(', ')}. Run npm run master:merge.`);
	} else {
		logger.info(`[Bootstrap] Master catalog ${configuration.masterControlDatabase} ready (${MASTER_CATALOG_TABLES.length} tables)`);
	}
	return missing;
}

/** Prepares every served tenant database. A tenant that cannot be reached is logged and skipped. */
export async function bootstrapTenants(): Promise<{ readyTenants: number[]; accountingTenants: number[] }> {
	await verifyMasterCatalog();
	const readyTenants: number[] = [];
	const accountingTenants: number[] = [];
	for (const tenant of await listServedTenants()) {
		try {
			const { accountingReady } = await runApplicationBootstrappers(tenant.tenantId);
			readyTenants.push(tenant.tenantId);
			if (accountingReady) accountingTenants.push(tenant.tenantId);
			logger.info(`[Bootstrap] Tenant ${tenant.tenantId} (${tenant.facilityCode} - ${tenant.name}) ready on ${tenant.databaseName}`);
		} catch (error: any) {
			logger.error(`[Bootstrap] Tenant ${tenant.tenantId} (${tenant.facilityCode}) skipped, database ${tenant.databaseName} unavailable: ${error?.message || error}`);
		}
	}
	return { readyTenants, accountingTenants };
}

export async function runApplicationBootstrappers(tenantId = 1, strict = false): Promise<{ accountingReady: boolean }> {
	await bootstrapLoginAccountSchema(tenantId);
	await bootstrapInventoryDefaults(tenantId);
	await bootstrapPharmacyTables(tenantId);
	await bootstrapPrescriptionTables(tenantId);
	await bootstrapEntityOrderTables(tenantId);
	await bootstrapBillingTables(tenantId);
	await bootstrapCalculationAndQcTables(tenantId);
	await bootstrapSuspendedBillingTables(tenantId);
	await bootstrapPhysicalSampleTables(tenantId);
	await bootstrapRefundTableSanitization(tenantId, strict);
	await bootstrapStaffFocTables(tenantId, strict);
	await bootstrapCommissionTables(tenantId);
	await bootstrapExpenseCategories(tenantId);
	await bootstrapExpenseWorkflow(tenantId);
	await bootstrapPayrollTables(tenantId);
	await bootstrapNotificationDefinitions(tenantId);
	await bootstrapInAppNotificationTables(tenantId);
	await bootstrapEmailTables(tenantId);
	await bootstrapResultValueAnalyticsTables(tenantId, strict);
	await bootstrapTestReportSettingsTable(tenantId);
	await bootstrapResultSettings(tenantId);
	await bootstrapApplicationSettings(tenantId);
	await bootstrapHomeCollectionTables(tenantId);
	await bootstrapAppointmentTables(tenantId);
	// Legacy seeds create checklist rows for demo order 1, not reference data.
	// A new facility must start with no home-collection transactions.
	if (!strict) await bootstrapHomeCollectionSeeds(tenantId);


	let accountingReady = false;

	try {
		await bootstrapAccountingTables(tenantId);
		accountingReady = true;
	} catch (error) {
		if (strict) throw error;
		console.error('[Bootstrap] Accounting module bootstrap failed (isolated, non-fatal):', error);
	}

	return { accountingReady };
}

export function startApplicationBackgroundWorkers(tenantIds: number[], options: { accountingReady: boolean }): void {
	startOptionalRedisCache();
	if (!options.accountingReady || tenantIds.length === 0) return;

	try {
		startAccountingWorker();
	} catch (error) {
		console.error('[Bootstrap] Accounting worker failed to start (isolated, non-fatal):', error);
	}

	const sweep = (label: string) => {
		for (const tenantId of tenantIds) {
			processPendingOutbox(tenantId).catch((error) => {
				console.error(`[Accounting] ${label} outbox sweep failed for tenant ${tenantId}:`, error);
			});
		}
	};
	sweep('Initial');
	setInterval(() => sweep('Periodic'), 15_000);
}
