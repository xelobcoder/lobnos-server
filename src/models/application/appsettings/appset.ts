import {
	q_active_tax,
	q_application_setting,
	q_get_email_pref,
	q_update_general_app_set,
	q_TruncateTable,
	q_update_sms_settings,
	q_get_sms_settings,
	q_truncateEmailPreference,
	q_update_email_preference,
	q_registration_settings,
	q_update_reg_fields,
	q_insert_reg_settings,
	q_general_email_settings,
	q_truncateGeneralSettings,
} from "./queries";

import { AppError, ApplicationBillSettings, ApplicationSettingsData, AppSetting, connectedServices, EmailPreference, IupdateRegisFields, jsonify } from "./Type";

import { promisifyQuery, rowAffected } from "../../../hooks/helper";
import KnexConnection from "../../../database/KnexConnections";
import RegionsDistrictsService from "./services/regions-districts-service";
import { isWorkspaceLayout, WorkspaceLayout } from "./workspaceLayout";




type numberBoolean = 0 | 1;

export default class ApplicationSettings {
	public async getAllAppSettings(tenantId: number): Promise<ApplicationSettingsData | null> {
		const result = await promisifyQuery(tenantId, q_application_setting);
		if (result.length > 0) {
			let record = result[0];
			record.workspaceLayout = isWorkspaceLayout(record.workspaceLayout) ? record.workspaceLayout : 'classic';
			record.services = record?.services != null ? jsonify
				(record.services) : null
			record.smsSettings = record?.smsSettings != null ? jsonify
				(record.smsSettings) : null
			record.billingsettings = record?.billingsettings != null ? jsonify
				(record.billingsettings) : null
			return record
		}
		return null
	}

	public async updateWorkspaceLayout(tenantId: number, workspaceLayout: WorkspaceLayout): Promise<boolean> {
		if (!isWorkspaceLayout(workspaceLayout)) throw new Error('Invalid workspaceLayout');
		const connection = await KnexConnection(tenantId);
		return connection.transaction(async trx => {
			const existing = await trx('applicationsettings').where({ keyid: 1 }).forUpdate().first();
			// Settings require regional codes and SMS configuration; do not fabricate a partial row.
			if (!existing) return false;
			await trx('applicationsettings').where({ keyid: 1 }).update({ workspaceLayout });
			return true;
		});
	}


	private static regionsDistrictsService = new RegionsDistrictsService();

	public static async getLabRegionalAndDistrictCodeAbbreviations(tenantId: number): Promise<{ region: string, district: string } | null> {
		return ApplicationSettings.regionsDistrictsService.getLabRegionalAndDistrictCodeAbbreviations(tenantId);
	}


	public async getAppBillSettings(tenantId: number): Promise<AppSetting> {
		try {
			const settings: ApplicationSettingsData | null = await this.getAllAppSettings(tenantId);

			if (!settings) return {
				includeTax: 0, PaidBillsBeforeTransaction: 0, taxValue: 0
			}
			const { includeTax, PaidBillsBeforeTransaction } = settings
			if (includeTax === 0) {
				return { includeTax, taxValue: 0, PaidBillsBeforeTransaction };
			}

			const getTax: [] = await promisifyQuery(tenantId, q_active_tax);
			if (getTax.length == 0) {
				return { includeTax, taxValue: 0, PaidBillsBeforeTransaction };
			} else {
				const taxValue = getTax.reduce((a, b: any) => {
					return a + b.value;
				}, 0);
				return {
					includeTax,
					taxValue: taxValue,
					PaidBillsBeforeTransaction,
				};
			}
		} catch (err) {
			throw err;
		}
	}


	public async applicationConnectedServices(tenantId: number): Promise<connectedServices | null> {
		const applicationSettings: ApplicationSettingsData | null = await this.getAllAppSettings(tenantId);
		if (applicationSettings) {
			const settings = applicationSettings
			if (settings && settings.services && settings.services != null) {
				const servicesString = settings['services']
				if (typeof servicesString === "string") {
					return jsonify<connectedServices>(servicesString);
				}
			}
		}
		return null;
	}

	public async getEmailPreference(tenantId: number): Promise<EmailPreference | []> {
		let data: EmailPreference[] | [] = await promisifyQuery(tenantId, q_get_email_pref);
		return data.length > 0 ? data[0] : [];
	}

	async shouldSendRejectionEmail(tenantId: number): Promise<boolean> {
		const settings: ApplicationSettingsData | null = await this.getAllAppSettings(tenantId);
		let isServicesActivated = false;
		let isRejectedPrefered = false;
		if (settings && settings["emailNotification"] == 1) {
			isServicesActivated = true;
		}

		const rejectionPreference: EmailPreference | [] = await this.getEmailPreference(tenantId);
		if (!Array.isArray(rejectionPreference) && rejectionPreference?.rejection == "Yes") {
			isRejectedPrefered = true;
		}

		if (isRejectedPrefered && isServicesActivated) {
			return true;
		}
		return false;
	}

	public async updateApplicationSettings(tenantId: number, data: ApplicationSettingsData): Promise<boolean> {
		const connection = await KnexConnection(tenantId);
		const {
			bulkregistration,
			emailNotification,
			fontsize,
			textcolor,
			DeactivateBilling24hrs,
			BackgroundColor,
			headerColor,
			sidebarColor,
			pageBackgroundColor,
			headerTextColor,
			sidebarTextColor,
			primaryColor,
			secondaryColor,
			PaidBillsBeforeTransaction,
			show_watermark,
			completeFlow,
			approvalbeforeprinting,
			includeTax,
			allowScientistToRegisterClient,
			services,
			AllowCrmToGiveDisocunt,
			withnessRefund,
			emailModuleActivated,
			billingidPrefix,
			patientIdGenerationMethod,
			regioncode,
			billingsettings,
			districtcode,
			fontFamily,
			allowValidationUpaid,
			allowPrintingUnpaid,
			allowResultEnteringUpaid,
			byPassCollection,
			byPassSampleValidation,
			byPassValidation,
			byPassProcessing,
			automakesupplierpaymentsexpense,
			automakeemployeepayrollpaymentsexpense,
			automakeoutsourcepaymentsexpense,
			automakecommissionpaymentsexpense,
			pinOnResultEntry,
			pinOnResultValidation,
			useamountpaidforcommissioncalculation,
			allowManagerToApproveExpenses,
			allowManagerToRefund,
			allowManagerToProcessPayroll,
			allowManagerToProcessCommission,
			isCommissionEarnedOnClinicianBilling,
			commissionRecipientPolicy,
			isCommissionEarnedOnOrganizationalBilling,
			isCommissionEarnedOnNHISBilling,
			isCommissionEarnedOnPHISBilling,
			makepdfprintingcompulsory,
			allowCrmToPrintResult,
			ageVariationLimits
		} = data;

		try {
			const result = await connection.transaction(async (trx) => {
				const existing = await trx('applicationsettings').where({ keyid: 1 }).first();
				const record = {
					bulkregistration,
					fontsize,
					textcolor,
					show_watermark: show_watermark ?? existing?.show_watermark ?? 0,
					BackgroundColor,
					headerColor: headerColor ?? existing?.headerColor ?? '#ffffff',
					sidebarColor: sidebarColor ?? existing?.sidebarColor ?? '#27ae60',
					pageBackgroundColor: pageBackgroundColor ?? existing?.pageBackgroundColor ?? BackgroundColor ?? '#f8f9fa',
					headerTextColor: headerTextColor ?? existing?.headerTextColor ?? '#2c3e50',
					sidebarTextColor: sidebarTextColor ?? existing?.sidebarTextColor ?? '#ffffff',
					primaryColor: primaryColor ?? existing?.primaryColor ?? '#27ae60',
					secondaryColor: secondaryColor ?? existing?.secondaryColor ?? '#6c757d',
					DeactivateBilling24hrs,
					PaidBillsBeforeTransaction,
					completeFlow,
					allowCrmToPrintResult: allowCrmToPrintResult ?? existing?.allowCrmToPrintResult ?? 0,
					approvalbeforeprinting,
					emailNotification,
					emailModuleActivated: emailModuleActivated ?? existing?.emailModuleActivated ?? 0,
					includeTax,
					services: JSON.stringify(services),
					AllowCrmToGiveDisocunt,
					withnessRefund: withnessRefund,
					billingidPrefix,
					patientIdGenerationMethod,
					regioncode,
					districtcode,
					billingsettings: billingsettings ? JSON.stringify(billingsettings) : null,
					fontFamily: fontFamily || data.fontFamily || 'Arial',
					allowResultEnteringUpaid: allowResultEnteringUpaid ?? 0,
					allowPrintingUnpaid: allowPrintingUnpaid ?? 0,
					allowValidationUpaid: allowValidationUpaid ?? 0,
					byPassCollection: byPassCollection ?? 0,
					byPassSampleValidation: byPassSampleValidation ?? 0,
					byPassValidation: byPassValidation ?? 0,
					byPassProcessing: byPassProcessing ?? 0,
					automakesupplierpaymentsexpense: automakesupplierpaymentsexpense ?? 0,
					automakeemployeepayrollpaymentsexpense: automakeemployeepayrollpaymentsexpense ?? 0,
					automakeoutsourcepaymentsexpense: automakeoutsourcepaymentsexpense ?? 0,
					automakecommissionpaymentsexpense: automakecommissionpaymentsexpense ?? 0,
					useamountpaidforcommissioncalculation: useamountpaidforcommissioncalculation ?? 0,
					pinOnResultEntry: pinOnResultEntry ?? 0,
					pinOnResultValidation: pinOnResultValidation ?? 0,
					allowScientistToRegisterClient: allowScientistToRegisterClient ?? 0,
					allowManagerToApproveExpenses: allowManagerToApproveExpenses ?? 0,
					allowManagerToRefund: allowManagerToRefund ?? 0,
					allowManagerToProcessPayroll: allowManagerToProcessPayroll ?? 0,
					allowManagerToProcessCommission: allowManagerToProcessCommission ?? 0,
					isCommissionEarnedOnClinicianBilling: isCommissionEarnedOnClinicianBilling ?? 0,
					isCommissionEarnedOnOrganizationalBilling: isCommissionEarnedOnOrganizationalBilling ?? 0,
					isCommissionEarnedOnNHISBilling: isCommissionEarnedOnNHISBilling ?? 0,
					isCommissionEarnedOnPHISBilling: isCommissionEarnedOnPHISBilling ?? 0,
					commissionRecipientPolicy: commissionRecipientPolicy ?? existing?.commissionRecipientPolicy ?? 'clinician',
					ageVariationLimits: ageVariationLimits ? JSON.stringify(ageVariationLimits) : null,
					makepdfprintingcompulsory: makepdfprintingcompulsory ?? 0,
				};
				let affectedRows = 0;
				if (existing) {
					affectedRows = await trx('applicationsettings').where({ keyid: 1 }).update(record);
				} else {
					affectedRows = await trx('applicationsettings').insert({ ...record, keyid: 1 });
				}
				return affectedRows > 0;
			});
			return result;
		} catch (err) {
			console.log(err);
			throw err;
		}
	}

	async updateSmsSettings(tenantId: number, data: string): Promise<boolean> {
		return rowAffected(await promisifyQuery(tenantId, q_update_sms_settings, [data]));
	}

	async getSmsSettings(tenantId: number): Promise<boolean | string | null> {
		const result = await promisifyQuery(tenantId, q_get_sms_settings);
		if (result.length == 0) return null;
		const { smsSettings } = result[0];
		return JSON.parse(smsSettings);
	}

	async updateEmailPreference(tenantId: number, data: EmailPreference): Promise<string> {
		const { registration, rejection, result, approval, transactions, birthday, billing } = data;
		const truncate = rowAffected(await promisifyQuery(tenantId, q_truncateEmailPreference));
		if (!truncate) return AppError.failed;
		const values: string[] = [registration, result, rejection, approval, transactions, birthday, billing];
		const outcome = rowAffected(await promisifyQuery(tenantId, q_update_email_preference, values));
		return outcome ? AppError.success : AppError.failed;
	}

	async getRegistrationSettings(tenantId: number) {
		return await promisifyQuery(tenantId, q_registration_settings);
	}

	async updateRegisFields(tenantId: number, id: number, data: string, employeeid: number): Promise<boolean> {
		return rowAffected(await promisifyQuery(tenantId, q_update_reg_fields, [data, employeeid, id]));
	}

	async insertRegistrationSettings(tenantId: number, fields: string, employeeid: number): Promise<boolean> {
		return rowAffected(await promisifyQuery(tenantId, q_insert_reg_settings, [JSON.stringify(fields), employeeid]));
	}

	async updateRegistrationFields(tenantId: number, data: IupdateRegisFields): Promise<boolean> {
		const { fields, employeeid } = data;

		if (!fields || !employeeid) {
			throw new ReferenceError("fields or employeeid not provided");
		}

		const previous = await this.getRegistrationSettings(tenantId);
		if (previous.length > 0) {
			const fieldid = previous[0]["id"];
			return await this.updateRegisFields(tenantId, fieldid, JSON.stringify(fields), employeeid);
		} else {
			return await this.insertRegistrationSettings(tenantId, fields, employeeid);
		}
	}
	async getGeneralEmailSettings(tenantId: number) {
		return await promisifyQuery(tenantId, q_general_email_settings);
	}

	async updateGeneralEmailSettings(tenantId: number, records: Object) {
		if (typeof records != "object") return false;
		const fields = await promisifyQuery(tenantId, q_truncateGeneralSettings);
		return rowAffected(fields)
	}

	async isApprovalSetTrue(tenantId: number) {
		const result = await this.getAllAppSettings(tenantId);
		if (result) {
			const approval_status = result.approvalbeforeprinting as numberBoolean;
			return !(parseInt(approval_status as unknown as string) === 0);
		}
		return false;
	}

	static updateApplicationBillSettings = async (tenantId: number, data: ApplicationBillSettings) => {
		const connection = await KnexConnection(tenantId)
		const result = await connection("applicationsettings").update({
			"billingsettings": JSON.stringify(data)
		}).where({ "keyid": 1 })
		return result;
	}
}
