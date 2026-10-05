import { bootstrapNotificationDefinitions } from '../models/application/notifications/services/NotificationBootstrapService';
import { bootstrapHomeCollectionSeeds, bootstrapHomeCollectionTables } from '../models/operations/sample/HomeCollection/BootstrapHomeCollection';
import { bootstrapCommissionTables } from '../models/commissions/commission-configurations/services/CommissionBootstrapService';
import { bootstrapBillingTables } from '../models/billing/BillingTableBootstrapper';
import { bootstrapExpenseCategories } from '../models/Expenses/ExpenseCategoryBootstrapper';
import { bootstrapExpenseWorkflow } from '../models/Expenses/ExpenseWorkflowBootstrapper';
import { bootstrapAccountingTables, processPendingOutbox, startAccountingWorker } from '../accountingModule';
import { bootstrapInAppNotificationTables } from '../models/application/in-app-notifications/InAppNotificationBootstrapper';
import { bootstrapResultValueAnalyticsTables } from '../models/result-value-analytics/ResultValueAnalyticsBootstrapper';
import { bootstrapLoginUsernames } from '../models/auth/LoginUsernameBootstrapper';
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

export async function runApplicationBootstrappers(tenantId = 1): Promise<{ accountingReady: boolean }> {
	await bootstrapInventoryDefaults(tenantId);
	await bootstrapPharmacyTables(tenantId);
	await bootstrapPrescriptionTables(tenantId);
	await bootstrapEntityOrderTables(tenantId);
	await bootstrapBillingTables(tenantId);
	await bootstrapCalculationAndQcTables(tenantId);
	await bootstrapSuspendedBillingTables(tenantId);
	await bootstrapPhysicalSampleTables(tenantId);
	await bootstrapRefundTableSanitization(tenantId);
	await bootstrapStaffFocTables(tenantId);
	await bootstrapCommissionTables(tenantId);
	await bootstrapExpenseCategories(tenantId);
	await bootstrapExpenseWorkflow(tenantId);
	await bootstrapPayrollTables(tenantId);
	await bootstrapNotificationDefinitions(tenantId);
	await bootstrapInAppNotificationTables(tenantId);
	await bootstrapLoginUsernames(tenantId);
	await bootstrapEmailTables(tenantId);
	await bootstrapResultValueAnalyticsTables(tenantId);
	await bootstrapTestReportSettingsTable(tenantId);
	await bootstrapApplicationSettings(tenantId);
	await bootstrapHomeCollectionTables(tenantId);
	await bootstrapHomeCollectionSeeds(tenantId);


	let accountingReady = false;

	try {
		await bootstrapAccountingTables(tenantId);
		accountingReady = true;
	} catch (error) {
		console.error('[Bootstrap] Accounting module bootstrap failed (isolated, non-fatal):', error);
	}

	return { accountingReady };
}

export function startApplicationBackgroundWorkers(tenantId = 1, options: { accountingReady: boolean }): void {
	if (!options.accountingReady) return;

	try {
		startAccountingWorker();
	} catch (error) {
		console.error('[Bootstrap] Accounting worker failed to start (isolated, non-fatal):', error);
	}
	processPendingOutbox(tenantId).catch((error) => {
		console.error('[Accounting] Initial outbox sweep failed:', error);
	});

	setInterval(() => {
		processPendingOutbox(tenantId).catch((error) => {
			console.error('[Accounting] Periodic outbox sweep failed:', error);
		});
	}, 15_000);
}