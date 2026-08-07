import { PrimeLimsTablenew_patients } from "../../database/DatabaseTableSchema";
import Registration from "../registration/registration";
import FieldConstraintsRepository from "../TestCreation/repositories/FieldConstraintsRepository.repo";
import Creator from "./creator";
import LoggingCriticalValueAlertRepository from "./Repo/loggingCriticalValueAlertRepository";
import resultEncrptionReferer from "./resultEncryptionReferer";

export class TrackValuesAlertClass extends Creator {
	tenantid: number;
	constructor(tenantid: number) {
		super(tenantid);
		this.tenantid = tenantid;
	}

	public async getCriticalDetailsWithAscension(crkeyId: number): Promise<{
		alert: LoggingCriticalValueAlert,
		patientInfo: PrimeLimsTablenew_patients,
		recordValues: any[]
	}> {
		if (!crkeyId) {
			throw new Error("CrKeyId not Provided");
		}

		const alertRepo = new LoggingCriticalValueAlertRepository(this.tenantid);
		const alert = await alertRepo.findById(crkeyId);
		if (!alert) {
			throw new Error("Alert not found");
		}

		const { testid, billingid } = alert;
		const registration = new Registration();
		const patientInfo = await registration.getPatientInfoUsingBillingId(this.tenantid, billingid);

		if (!Array.isArray(patientInfo) || !patientInfo.length) {
			throw new Error("Patient information not found");
		}
		const patientid = patientInfo[0].patientid;

		const creator = new Creator(testid);
		const [recordValues, constraints] = await Promise.all([
			creator.getPreviousRecords(this.tenantid, testid, billingid, patientid),
			new FieldConstraintsRepository(this.tenantid).findByTestId(testid)
		]);


		const decrtyptedRecordedValues = Array.isArray(recordValues) && recordValues.length > 0 ?
			await resultEncrptionReferer(recordValues, "decryption") : { resources: [] }

		const recordValuesWithConstraints = Array.isArray(decrtyptedRecordedValues.resources)
			? decrtyptedRecordedValues.resources
				.map(record => {
					const constraint = constraints.filter(c => parseInt(c.fieldid.toString()) === parseInt(record.fieldid.toString()));
					return constraint ? { ...record, constraints: [constraint], fieid: record.name } : null;
				})
				.filter(record => record !== null)
			: [];


		return {
			alert,
			patientInfo: patientInfo[0],
			recordValues: recordValuesWithConstraints
		};
	}
}