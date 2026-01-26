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
import { PrimeLimsTabledistricts, PrimeLimsTableregions } from "../../../database/DatabaseTableSchema";
export default class ApplicationSettings {
	public async getAllAppSettings(tenantId: number): Promise<ApplicationSettingsData | null> {
		const result = await promisifyQuery(tenantId, q_application_setting);
		if (result.length > 0) {
			let record = result[0];
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

	private static async getLabRegionalAndDistrictCode(tenantId: number) {
		const connection = await KnexConnection(tenantId)
		return connection("applicationsettings")
			.select(["regioncode", "districtcode"])
			.where("keyid", 1)
			.first();
	}

	public static async getLabRegionalAndDistrictCodeAbbreviations(tenantId: number): Promise<{ region: string, district: string } | null> {
		const codeValues = await this.getLabRegionalAndDistrictCode(tenantId);
		if (!codeValues) return null;
		const connection = await KnexConnection(tenantId)
		const result: PrimeLimsTableregions & PrimeLimsTabledistricts = await connection("districts")
			.join("regions", "regions.id", "districts.regionid")
			.where({ "districts.regionid": codeValues.regioncode, "districts.id": codeValues.districtcode })
			.select("*")
			.first();
		if (!result) return null;
		return { region: result.regioncode, district: result.code }
	}



	public async getAppBillSettings(tenantId: number): Promise<AppSetting> {
		try {
			const settings: ApplicationSettingsData = await this.getAllAppSettings(tenantId);

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
		const applicationSettings: ApplicationSettingsData = await this.getAllAppSettings(tenantId);
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
		const settings: ApplicationSettingsData = await this.getAllAppSettings(tenantId);
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
			PaidBillsBeforeTransaction,
			completeFlow,
			approvalbeforeprinting,
			includeTax,
			services,
			AllowCrmToGiveDisocunt,
			withnessRefund,
			billingidPrefix,
			patientIdGenerationMethod,
			regioncode,
			billingsettings,
			districtcode,
			fontFamily,
			allowValidationUpaid,
			allowPrintingUnpaid,
			allowResultEnteringUpaid
		} = data;

		try {
			const result = await connection.transaction(async (trx) => {
				const existing = await trx('applicationsettings').where({ keyid: 1 }).first();
				const record = {
					bulkregistration,
					fontsize,
					textcolor,
					BackgroundColor,
					DeactivateBilling24hrs,
					PaidBillsBeforeTransaction,
					completeFlow,
					approvalbeforeprinting,
					emailNotification,
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

	async getSmsSettings(tenantId: number): Promise<boolean | string> {
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

	async updateGeneralEmailSettings(tenantId: number, records) {
		if (typeof records != "object") return false;
		const fields = await promisifyQuery(tenantId, q_truncateGeneralSettings);
		return rowAffected(fields)
	}

	async isApprovalSetTrue(tenantId: number) {
		const result = await this.getAllAppSettings(tenantId);
		if (result) {
			const approval_status = result[0]["approvalbeforeprinting"];
			return !(parseInt(approval_status) === 0);
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

