import { Knex } from "knex";
import { CommissionDefaultRepository } from "../models/commissions/commission-configurations/repositories/CommissionDefaultRepository";
import OutsourcedCases from "../models/organization/outsourcingOrganization/outsourcedCases";
import ApplicationSettings from "../models/application/appsettings/appset";
import { buildLoginUsername, getLabLoginPrefix } from "../models/auth/LoginUsernameBootstrapper";

type DbRunner = Knex | Knex.Transaction;

async function getDefaultCommissionPercentage(
	tenantId: number,
	db: DbRunner,
	recipientType: "clinician" | "organization"
): Promise<number> {
	const defaultConfig = await new CommissionDefaultRepository(tenantId, db)
		.findActiveConfigByRecipientType(recipientType);
	return defaultConfig?.percentage_rate ? Number(defaultConfig.percentage_rate) : 0;
}

export async function applyNewPatientAfterInsert(
	tenantId: number,
	db: DbRunner,
	payload: { patientid: number; firstname: string; lastname: string }
) {
	const username = `${payload.firstname}${payload.lastname}`;
	const password = `${payload.firstname}${payload.lastname}${payload.patientid}`;
	const loginPrefix = await getLabLoginPrefix(tenantId, db);

	await db("patients_credentials").insert({
		patientid: payload.patientid,
		username,
		login_username: buildLoginUsername(loginPrefix, 'patient', payload.patientid),
		password,
		updated_on: new Date(),
	});

	await db("patientemmergencycontactinformation").insert({
		patientid: payload.patientid,
	});

	await db("patientsaddress").insert({
		patientid: payload.patientid,
	});

	await db("patients_settings").insert({
		patientid: payload.patientid,
	});
}

export async function applyNewPatientAfterDelete(db: DbRunner, patientid: number) {
	await db("patientemmergencycontactinformation").where({ patientid }).del();
	await db("patients_settings").where({ patientid }).del();
	await db("patients_credentials").where({ patientid }).del();
	await db("patientsaddress").where({ patientid }).del();
}

type DboservicesAuditAction = "INSERT" | "UPDATE" | "DELETE";

export async function insertDboservicesAudit(
	db: DbRunner,
	service: any,
	action: DboservicesAuditAction,
	actor?: string
) {
	await db("dboservices_audit").insert({
		serviceid: service.serviceid,
		billingid: service.billingid,
		trackId: service.trackId,
		cost: service.cost,
		employeeid: service.employeeid,
		serviceCategory: service.serviceCategory,
		categoryTrackId: service.categoryTrackId,
		clinicianId: service.clinicianId ?? null,
		organizationId: service.organizationId ?? null,
		registrationType: service.registrationType ?? null,
		branchid: service.branchid,
		isoutsourced: service.isoutsourced,
		outsourceid: service.outsourceid ?? null,
		serviceAddedOn: service.serviceAddedOn,
		taxList: service.taxList ?? null,
		taxValue: service.taxValue,
		amountIncurredDueTax: service.amountIncurredDueTax,
		taxIncluded: service.taxIncluded,
		discount: service.discount,
		totalcost: service.totalcost,
		totalpayable: service.totalpayable,
		isNHIS: service.isNHIS,
		isPHIS: service.isPHIS,
		insuranceid: service.insuranceid ?? null,
		claimCode: service.claimCode ?? null,
		hasNightAdjustment: service.hasNightAdjustment,
		nightAdjustmentValue: service.nightAdjustmentValue,
		nightAdjustmentMode: service.nightAdjustmentMode,
		isPackageUsed: service.isPackageUsed,
		packageid: service.packageid ?? null,
		action_type: action,
		actor: actor ?? null,
		userAdjustmentType: service.userAdjustmentType ?? null,
		userAdjustedValue: service.userAdjustedValue ?? null,
	});
}

export async function applyDboservicesAfterInsert(tenantId: number, db: DbRunner, service: any, actor?: string) {
	await insertDboservicesAudit(db, service, "INSERT", actor);

	if (service.serviceCategory === "SERVICES" && Number(service.categoryTrackId) === 5) {
		await db("servicestracking").insert({ serviceid: service.serviceid, employeeid: service.employeeid, status: 0, comments: "New service added, waiting for processing" });
	}

	const existingRefundRow = await db("dbobillingrefundtable")
		.select("refundid")
		.where({ serviceid: service.serviceid })
		.first();
	if (!existingRefundRow) {
		await db("dbobillingrefundtable").insert({
			serviceid: service.serviceid,
			refundedBy: 0,
			firstWitness: 0,
		});
	}

	const isOutsourced = Number(service.isoutsourced) === 1;
	const outsourceId = service.outsourceid ? Number(service.outsourceid) : 0;
	if (isOutsourced && outsourceId > 0) {
		const [trackingid] = await db("outsourcedtesttracking").insert({
			serviceid: service.serviceid,
			testid: service.trackId,
			outsourceid: outsourceId,
			employeeid: service.employeeid,
			status: 0,
			comments: "New outsourced service added, waiting for dispatch",
		});


		const applicationsettings = await new ApplicationSettings().getAllAppSettings(tenantId);
		const automatedExpenseEnabled = applicationsettings?.automakeoutsourcepaymentsexpense ? parseInt(applicationsettings?.automakeoutsourcepaymentsexpense.toString() || '0') : 0;
		if (!automatedExpenseEnabled) return;

		try {
			await OutsourcedCases.triggerAutomatedExpenseLifecycle(tenantId, {
				serviceid: service.serviceid,
				testid: service.trackId,
				trackingid: trackingid as number,
				branchid: service.branchid,
				employeeid: service.employeeid,
				outsourcedid: outsourceId
			}, db);
		} catch (error) {
			console.error("Failed to trigger automatic expense for outsourced service:", error);
		}
	}

	const clinicianId = service.clinicianId ? Number(service.clinicianId) : null;
	const organizationId = service.organizationId ? Number(service.organizationId) : null;

	let commissionType: "clinician" | "organization" | null = null;
	let recipientId: number | null = null;

	if (clinicianId !== null) {
		commissionType = "clinician";
		recipientId = clinicianId;
	} else if (organizationId !== null) {
		commissionType = "organization";
		recipientId = organizationId;
	}

	if (commissionType && recipientId !== null) {
		let commissionPercentage = 0;
		if (commissionType === "clinician") {
			const row = await db("clinicianpaymentinfo")
				.select("commission")
				.where({ clinicianid: recipientId })
				.first();
			commissionPercentage = row?.commission ? Number(row.commission) : 0;
		} else {
			const row = await db("organizationaccountinformation")
				.select("commission")
				.where({ organizationid: recipientId })
				.first();
			commissionPercentage = row?.commission ? Number(row.commission) : 0;
		}

		// await db("commission_tracking").insert({
		// 	serviceid: service.serviceid,
		// 	commission_percentage: commissionPercentage,
		// 	commission_due: (Number(service.totalpayable || 0) * commissionPercentage) / 100,
		// 	type: commissionType,
		// 	recipient_id: recipientId,
		// 	calculated_at: db.fn.now(),
		// 	created_at: db.fn.now(),
		// 	updated_at: db.fn.now(),
		// });
	}
}

export async function applyDboservicesAfterUpdate(db: DbRunner, service: any, actor?: string) {
	await insertDboservicesAudit(db, service, "UPDATE", actor);
}

export async function applyDboservicesAfterDelete(db: DbRunner, service: any, actor?: string) {
	await insertDboservicesAudit(db, service, "DELETE", actor);
}

export async function applyTestAscensionAfterInsertApprovalSettings(db: DbRunner, ascensionid: number) {
	const existing = await db("dbotestresultapproval").select("id").where({ ascensionid }).first();
	if (existing) return;

	let minvalidation = 1;
	let maxvalidation = 2;

	const row = await db("resultsettings").select("resultsEntrySettings")
		.where({ id: 1 }).first();
	let settings: any = row?.resultsEntrySettings;
	if (typeof settings === "string") {
		try {
			settings = JSON.parse(settings);
		} catch {
			settings = null;
		}
	}

	const minRaw = settings?.minimumResultValidation;
	const maxRaw = settings?.maximumResultValidation;
	const minParsed = minRaw !== undefined && minRaw !== null ? Number(minRaw) : NaN;
	const maxParsed = maxRaw !== undefined && maxRaw !== null ? Number(maxRaw) : NaN;
	if (!isNaN(minParsed) && isFinite(minParsed)) minvalidation = minParsed;
	if (!isNaN(maxParsed) && isFinite(maxParsed)) maxvalidation = maxParsed;

	await db("dbotestresultapproval").insert({
		ascensionid,
		minvalidation,
		maxvalidation,
		printCount: 0,
	});
}

export async function applyOrganizationAfterInsert(db: DbRunner, organizationid: number) {
	const contact = await db("organizationcontactperson")
		.select("id")
		.where({ organizationid })
		.first();
	if (!contact) {
		await db("organizationcontactperson").insert({ organizationid });
	}

	const account = await db("organizationaccountinformation")
		.select("id")
		.where({ organizationid })
		.first();
	if (!account) {
		// insert default commission value for the organization if global commission default exist for organization
		const commissionValue = await getDefaultCommissionPercentage(0, db, "organization");
		await db("organizationaccountinformation").insert({ organizationid, commission: commissionValue });
	}
}

export async function applyClinicianAfterInsert(tenantId: number, db: DbRunner, payload: { clinicianid: number; identifier: string }) {
	// 1. check for default commissions for clinician exist , if yes use the default value to create the clinician commision amount else create with 0 commission
	const commissionValue = await getDefaultCommissionPercentage(tenantId, db, "clinician");
	const payment = await db("clinicianpaymentinfo")
		.select("id")
		.where({ clinicianid: payload.clinicianid })
		.first();
	if (!payment) {
		await db("clinicianpaymentinfo").insert({
			clinicianid: payload.clinicianid,
			module: "cash",
			commission: commissionValue,
		});
	}

	const credentials = await db("clinicianscredentials")
		.select("id")
		.where({ clinicianid: payload.clinicianid })
		.first();
	if (!credentials) {
		const crypto = await import("crypto");
		const randomPassword = crypto.randomBytes(10).toString("hex");
		const loginPrefix = await getLabLoginPrefix(tenantId, db);
		await db("clinicianscredentials").insert({
			clinicianid: payload.clinicianid,
			identifier: payload.identifier,
			login_username: buildLoginUsername(loginPrefix, 'clinician', payload.clinicianid),
			password: randomPassword,
			authenticationMode: "SMS",
		});
	}
}

export async function applyClinicianAfterDelete(db: DbRunner, clinicianid: number) {
	await db("clinicianpaymentinfo").where({ clinicianid }).del();
	await db("clinicianscredentials").where({ clinicianid }).del();
}

export async function applyTestPanelsAfterInsert(db: DbRunner, payload: { testid: number; price: number; iscustom: number }) {
	const existingDetails = await db("testdetails").select("id").where({ testid: payload.testid }).first();
	if (!existingDetails) {
		await db("testdetails").insert({
			testid: payload.testid,
			testcost: payload.price,
			testprice: payload.price,
			updatedby: 0,
			childrenlimit: "",
			instrumentation: "",
		});
	}

	const isCustom = Number(payload.iscustom) === 1;
	if (isCustom) {
		const existingCustom = await db("customtestcreation").select("id").where({ testid: payload.testid }).first();
		if (!existingCustom) {
			await db("customtestcreation").insert({ testid: payload.testid });
		}
	}
}
