// SmsMessageParser.ts
// Utility class for parsing and personalizing SMS message templates

import { PrimeLimsTableclinicianbasicinfo, PrimeLimsTablenew_patients, PrimeLimsTableorganization } from "../../../../database/DatabaseTableSchema";
import ClinicianClass from "../../../clincians/clinicianClass";
import Organization from "../../../organization/organization";
import Registration from "../../../registration/registration";
import { NewRegistration } from "../../../registration/types";
import { PrimeSmsJob, PrimeSmsJobsRepo } from "../repositories/PrimeSmsJobsRepo";
import { PrimeSmsTemplate, PrimeSmsTemplatesRepo } from "../repositories/PrimeSmsTemplatesRepo";
import { SmsJobsService } from "../services/SmsJobsService";
import { Logger } from '../services/Logger';

export class SmsMessageParser {
	tenantId: number;
	category: 'clinician' | 'patient' | 'organization';
	targetId: number;
	constructor(tenantId: number, category: 'clinician' | 'patient' | 'organization', targetId: number) {
		this.tenantId = tenantId;
		this.category = category;
		this.targetId = targetId;
	}
	static parse(template: string, data: Record<string, any>): string {
		if (!template || typeof template !== 'string') return '';
		return template.replace(/{{\s*(\w+)\s*}}|{\s*(\w+)\s*}/g, (match, key1, key2) => {
			const key = key1 || key2;
			return key in data ? String(data[key]) : '';
		});
	}

	private async loadOrganizationData(organizationId: number): Promise<Organization[]> {
		return await new Organization(organizationId).getOrganizationBasic(this.tenantId)
	}

	private async loadPatientData(patientId: number): Promise<NewRegistration> {
		try {
			const data = await new Registration().getPatientBasicData(this.tenantId, patientId);
			Logger.info('Loaded patient data: ' + JSON.stringify(data));
			return data;
		} catch (err) {
			Logger.error('Error loading patient data for patientId ' + patientId, err);
			throw err;
		}
	}

	private async loadClinicianData(clinicianId: number): Promise<PrimeLimsTableclinicianbasicinfo[]> {
		return await new ClinicianClass().getClinicianBasicInfo(this.tenantId, clinicianId);
	}

	private reformatData(
		data: PrimeLimsTablenew_patients[] | PrimeLimsTableclinicianbasicinfo[] | PrimeLimsTableorganization[],
		mobiletarget: string
	):
		(Partial<PrimeLimsTableorganization> & { phonee164: string })[] |
		(Partial<PrimeLimsTablenew_patients> & { phonee164: string })[] |
		(Partial<PrimeLimsTableclinicianbasicinfo> & { phonee164: string })[] {
		if (Array.isArray(data) && data.length > 0) {
			return data.map((item: PrimeLimsTablenew_patients | PrimeLimsTableclinicianbasicinfo | PrimeLimsTableorganization) => ({ ...item, phonee164: item[mobiletarget] }));
		}
		return [];
	}


	public async loadBatchData(
		start: number,
		end: number
	): Promise<
		(Partial<PrimeLimsTableorganization> & { phonee164: string })[] |
		(Partial<PrimeLimsTablenew_patients> & { phonee164: string })[] |
		(Partial<PrimeLimsTableclinicianbasicinfo> & { phonee164: string })[]
	> {
		switch (this.category) {
			case 'clinician':
				const clinicians = await new ClinicianClass().getClinicianBatch(this.tenantId, start, end);
				return this.reformatData(clinicians, 'phone');
			case 'patient':
				const patients = await Registration.patientsInformationBatch(this.tenantId, start, end) as PrimeLimsTablenew_patients[];
				return this.reformatData(patients, 'mobile_number');
			case 'organization':
				const organizations = await Organization.paginatedOrganizationInformation(this.tenantId, start, end);
				return this.reformatData(organizations, 'phone');
			default:
				throw new Error(`Unknown category: ${this.category}`);
		}
	}

	private getCategoryTotalCount(): Promise<number> {
		switch (this.category) {
			case 'clinician':
				return ClinicianClass.getTotalClinicians(this.tenantId);
			case 'patient':
				return Registration.getTotalPatients(this.tenantId);
			case 'organization':
				return Organization.getOrganizationTotalCount(this.tenantId);
			default:
				throw new Error(`Unknown category: ${this.category}`);
		}
	}


	public getTotalCount(): Promise<number> {
		return this.getCategoryTotalCount();
	}

	private async loadCategoryData(): Promise<NewRegistration | PrimeLimsTableclinicianbasicinfo[] | Organization[]> {
		let datasource = {}
		switch (this.category) {
			case 'clinician':
				datasource = await this.loadClinicianData(this.targetId);
				break
			case 'patient':
				datasource = await this.loadPatientData(this.targetId);
				break;
			case 'organization':
				datasource = await this.loadOrganizationData(this.targetId);
				break;
			default:
				throw new Error(`Unknown category: ${this.category}`);
		}
		if (!datasource) {
			throw new Error(`No data found for category: ${this.category} with ID: ${this.targetId}`);
		}

		if (Array.isArray(datasource)) {
			return datasource.length > 0 ? datasource[0] : null;
		}
		return datasource as Promise<NewRegistration | PrimeLimsTableclinicianbasicinfo[] | Organization[]>;
	}


	public async humanizeTemplate(jobId: number | Partial<PrimeSmsJob>): Promise<string> {
		const job = typeof jobId === 'number' ? await new PrimeSmsJobsRepo(this.tenantId).findById(jobId) : jobId;

		if (!job) throw new Error(`Job with ID ${jobId} not found`);
		const { templateid } = jobId as PrimeSmsJob;
		if (!templateid) throw new Error(`Job with ID ${jobId} does not have a template associated`);

		const template: PrimeSmsTemplate | null = await new PrimeSmsTemplatesRepo(this.tenantId).findById(templateid);
		if (!template) throw new Error(`Template with ID ${templateid} not found`);
		const { category } = template;

		if (!category || category !== this.category) {
			throw new Error(`Template category ${category} does not match job category ${this.category}`);
		}

		const data = await this.loadCategoryData();
		if (!data) {
			throw new Error(`No data found for category: ${this.category} with ID: ${this.targetId}`);
		}

		return SmsMessageParser.parse(template.body, data);
	}
}