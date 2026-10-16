import { testpanel } from "../../testpanel/testpanelList";
import {
	getGenderQuery, insert_critical_value_alert,
	modify_ultrasound_field_to_support_long_text,
	q_comments_query,
	q_get_a_single_ultrasound_mapper,
	q_get_a_single_ultrasound_template,
	q_get_drug_reaction_inserts_find,
	q_get_test_ascension_name_and_id,
	q_get_ultrasound_template_field,
	q_get_ultrasound_template_mapper,
	q_get_ultrasound_template_mapper_scan_type,
	q_has_drug_reaction_inserts,
	q_insert_drug_reaction,
	q_insert_new_ultrasound_template_mapper,
	q_insert_ultrasound_template,
	q_update_drug_reaction,
	q_update_ultrasound_template,
	q_update_ultrasound_template_mapper,
	testCreationRule, update_creation_query
} from "./queries";
import Registration from "../registration/registration";
import { OperationsFailures } from "../operations/types";
import { TestAscension } from "../operations/ascension";
import { v4 as uuidv4 } from 'uuid';
import { NewRegistration } from "../registration/types";
import { promisifyQuery, rowAffected, paginationQuery } from "../../hooks/helper";
import { CreationRule, resultEntryTemplateView, previewReportView, resultEntryType } from "./creator-types";
import resultEncrptionReferer from "./resultEncryptionReferer";
import TestCreationRulesRepository, { TestCreationRule } from "../TestCreation/TestCreationRulesRepository";
import { CriticalValueEvaluator } from './CriticalValueEvaluator';
import TestDetailCategory from "../operations/testFieldsCategoryClass";
import KnexConnection from "../../database/KnexConnections";
import { encrypt_value } from "../../utils/encryptionModels";
import { CalculationFormulaService } from './calculations/CalculationFormulaService';
import { requireDailyQcAcceptance } from './calculations/QCEnforcementService';
import { buildStaleDrugReactionDelete } from './resultDrugReactions';
import { PrimeLimsTabletest_results } from "../../database/DatabaseTableSchema";
import RequestAccess from "../security/RequestAcessResult/requestAcess";
import RolesRepository from "../settings/users/RolesRepository";
import ImagingResultAuditRepository from "../operations/imaging/ImagingResultAuditRepository";
import ApplicationSettings from "../application/appsettings/appset";
import { applyDemographicLimits, getAgeGroup } from "./demographic-limits";

export default class Creator {
	testid: number;

	constructor(testid: number) {
		this.testid = testid;
	}

	async getTestCreationRule(tenantId: number) {
		if (!this.testid) throw new Error("testid is required");
		const rule = await promisifyQuery(tenantId, testCreationRule, [this.testid]);
		if (rule.length > 0 && rule[0].creationrule !== "{}") {
			const result = JSON.parse(rule[0].creationrule) as CreationRule[];
			return result;
		}
		return [];
	}

	async getPreviousRecords(tenantId: number, testid: number, billingid: number, patientid: number) {
		const previousRecords = await promisifyQuery(tenantId, `SELECT * FROM test_results WHERE billingid = ? AND patientid = ? AND testid  = ?`, [
			billingid,
			patientid,
			testid
		]);
		return previousRecords;
	}

	static async getRecordedResultsUsingascensionId(tenantId: number, ascensionid: number): Promise<PrimeLimsTabletest_results[] | []> {
		const query = `SELECT * FROM test_results WHERE ascensionid = ?`;
		const records = await promisifyQuery(tenantId, query, [ascensionid]);
		return records.length > 0 ? records : [];
	}

	async getPreviousRecordsOrCreationRule(tenantId: number, testid: number, billingid: number, patientid: number): Promise<TestCreationRule[] | null | undefined> {
		try {
			const [previousRecords, creationRules, patientBasicData, settings] = await Promise.all([
				this.getPreviousRecords(tenantId, testid, billingid, patientid),
				new TestCreationRulesRepository(tenantId).findByTestId(testid),
				new Registration().getPatientBasicData(tenantId, patientid),
				new ApplicationSettings().getAllAppSettings(tenantId)
			]);

			const patientGender = (patientBasicData?.gender || '').toString();
			const patientAgeType = (patientBasicData as any)?.ageType || (patientBasicData as any)?.agetype;
			const ageGroup = getAgeGroup(patientBasicData?.age, patientAgeType, settings?.ageVariationLimits);
			const rulesWithLimits = creationRules.map(rule => applyDemographicLimits(rule, patientGender, ageGroup));

			if (previousRecords.length === 0) {
				return rulesWithLimits.map(item => {
					item.fieldid = item.id;
					return item;
				});
			}

			if (previousRecords.length > 0 && rulesWithLimits.length > 0) {
				const mappings = rulesWithLimits.map(rule => {
					const previous = previousRecords.find((item: any) => item.fieldid === rule.id);
					const state = previous ? { ...rule, ...previous } : {
						...rule,
						value: encrypt_value('NIL'),
						originalvalue: encrypt_value('NIL'),
						fieldid: rule.id,
						field: rule.name
					};
					return state;
				});
				return mappings;
			}
		} catch (err) {

		}
	}
	async getPreviousRecordsWithTestRuleMapped(tenantId: number, testid: number, billingid: number, patientid: number
	): Promise<TestCreationRule[] | null> {
		try {
			const [previousRecords, creationRules] = await Promise.all([
				this.getPreviousRecords(tenantId, testid, billingid, patientid),
				new TestCreationRulesRepository(tenantId).findByTestId(testid)
			]);

			if (!Array.isArray(previousRecords) || previousRecords.length === 0 ||
				!Array.isArray(creationRules) || creationRules.length === 0) {
				return null;
			}

			const mappings = previousRecords.map(item => {
				const matchingRule = creationRules.find(rule => rule.id === item.fieldid);
				return matchingRule ? { ...matchingRule, ...item } : null;
			});

			return mappings.filter(Boolean)

		} catch (error) {
			console.error('Error in getPreviousRecordsWithTestRuleMapped:', error);
			throw new Error('Failed to map previous records with test rules');
		}
	}

	async getResultEntryTest(tenantId: number, scvid: string, ptid: string, target: any) {
		if (typeof target == "string") target = target.split(",");
		const patientid: number = parseInt(ptid.slice(target[1]));
		const billingid: number = parseInt(scvid.slice(target[0]));
		const patientdata: NewRegistration | null = await new Registration().getPatientBasicData(tenantId, patientid);
		if (patientdata === null) return OperationsFailures.unfoundID + '. Patient Not Found'
		const collection: [] = await promisifyQuery(tenantId, q_get_test_ascension_name_and_id, [billingid]);

		if (collection.length > 0) {
			return { personal_data: patientdata, test: collection || [] };
		}
		return { personal_data: patientdata || {}, test: collection || [] };
	}

	async getResultEntryRecords(tenantId: number, testid: number, billingid: number, patientid: number): Promise<resultEntryTemplateView | string> {
		try {
			let hasDrugs = false;
			const parsedBillingid = parseInt(billingid.toString());
			const parsedPatientid = parseInt(patientid.toString());
			const testname = await testpanel.getTestUsingTestid(tenantId, testid);
			if (!testname) return OperationsFailures.unfoundID;
			let previousRecords = await this.getPreviousRecordsOrCreationRule(tenantId, testid, parsedBillingid, parsedPatientid);
			if (!previousRecords || !Array.isArray(previousRecords)) {
				return { result: [], testname: null, hasDrugs: false, testInfo: null };
			}
			if (previousRecords.length === 0) return { result: [], testname: null, hasDrugs: false, testInfo: null };
			hasDrugs = await this.hasDrugAssociatedWithTest(tenantId, testid, hasDrugs);
			return { result: previousRecords, testname, hasDrugs, testInfo: null };
		} catch (err) {
			throw err;
		}
	}

	async getCustomPreviousRecords(tenantId: number, testid: number, billingid: number, patientid: number): Promise<resultEntryTemplateView | string> {
		try {
			let hasDrugs = false;
			const parsedBillingid = parseInt(billingid.toString());
			const parsedPatientid = parseInt(patientid.toString());
			const testInfo = await testpanel.getTestInfo(tenantId, testid);
			const testname = testInfo.name;
			if (!testname) return OperationsFailures.unfoundID;

			let previousRecords = await this.getPreviousRecordsWithTestRuleMapped(tenantId, testid, parsedBillingid, parsedPatientid);
			if (!Array.isArray(previousRecords) || previousRecords.length === 0) return { result: [], testname: null, hasDrugs: false, testInfo: null };

			const testDetails = await testpanel.getTestDetails(tenantId, testid);
			hasDrugs = await this.hasDrugAssociatedWithTest(tenantId, testid, hasDrugs);
			const hasGenderVariation = testDetails ? testDetails['hasGenderVariation'] : false;

			const packet = await promisifyQuery(tenantId, getGenderQuery, [patientid]);
			const clientGender = packet.length > 0 ? packet[0]["gender"] : "";
			const clientAge = packet.length > 0 ? packet[0]["age"] : undefined;
			const clientAgeType = packet.length > 0 ? packet[0]["agetype"] : undefined;
			const settings = await new ApplicationSettings().getAllAppSettings(tenantId);

			const ageGroup = getAgeGroup(clientAge, clientAgeType, settings?.ageVariationLimits);
			console.log({ ageGroup, clientAge, clientAgeType })
			previousRecords = previousRecords.map(item => applyDemographicLimits(item as TestCreationRule, clientGender, ageGroup));

			if (hasGenderVariation && clientGender) {
				previousRecords = previousRecords.map((item) => {
					const obj: any = { ...item };
					if ((item as any)[clientGender]) {
						obj.upperlimit = (item as any)[clientGender].upperlimit;
						obj.lowerlimit = (item as any)[clientGender].lowerlimit;
						delete obj.female;
						delete obj.male;
					}
					return obj;
				});
			}

			const testdetailcategory = await TestDetailCategory.getByTestId(tenantId, testid);

			return { testname, result: previousRecords, hasDrugs, testInfo, testdetailcategory }
		} catch (err) {
			throw err;
		}
	}

	async resultPresentationView(tenantId: number, testid: number, billingid: number, patientid: number): Promise<previewReportView | [] | string> {
		const resultDataset = await this.getCustomPreviousRecords(tenantId, testid, billingid, patientid);
		if (typeof resultDataset == "string") return resultDataset
		const { result, hasDrugs, testname, testInfo, testdetailcategory } = resultDataset

		if (result && Array.isArray(result) && result.length > 0) {
			let resultOmissionMaleFemale = result.map((item: any, index: number) => {
				const { female, male, isValueTracked, type, valueAlert, useplain, alert, constraint,
					...rest } = item;
				return rest;
			})
			return {
				result: resultOmissionMaleFemale,
				hasDrugs,
				testname,
				testInfo,
				testdetailcategory: testdetailcategory || null
			};
		}
		return []
	}

	private async hasDrugAssociatedWithTest(tenantId: number, testid: number, hasDrugs: boolean) {
		let testDetails = await testpanel.getPanelEditSingle(tenantId, testid);

		if (Array.isArray(testDetails) && testDetails.length > 0) {
			const iHasDrugs = testDetails[0]['hasDrugs'];
			hasDrugs = iHasDrugs == 1 ? true : false;
		}
		return hasDrugs;
	}

	async getCustomCommentsRecords(tenantId: number, billingid: number, testid: number) {
		if (!billingid || !testid) {
			throw new Error("testid and billingid required");
		}
		let comments = await promisifyQuery(tenantId, q_comments_query, [billingid, testid]);
		return comments.length > 0 ? comments[0]["comments"] : "";
	}

	async createUltrasoundTemplateTable(tenantId: number, tablename: string) {
		return await promisifyQuery(tenantId, modify_ultrasound_field_to_support_long_text);
	}

	async updateTestCreationRule(tenantId: number, data: CreationRule[]) {
		if (!this.testid || !data) throw new Error("testid and data is required");
		const stringdata = JSON.stringify(data);
		const isUpdated = await promisifyQuery(tenantId, update_creation_query, [stringdata, this.testid]);
		const isUltrasoundScan = await testpanel.isTestUltrasoundScanCategory(tenantId, this.testid);

		if (isUltrasoundScan) {
			const tableName = testpanel.generateTableNameUsingTestid(this.testid);
			this.createUltrasoundTemplateTable(tenantId, tableName);
		}
		return rowAffected(isUpdated);
	}

	sanitize_patientid_billingid_query(csvid: string, ptid: string, target: string | string[]): { patientid: number, billingid: number } {
		if (typeof target != "string" && !Array.isArray(target)) throw new TypeError("Array or string separated by delimeter , required");
		let splitter = target;
		if (typeof target == "string") {
			splitter = target.trim().split(",");
		}

		const ptsplitter = parseInt(splitter[1]);
		const blsplitter = parseInt(splitter[0]);
		let patientid = ptid.slice(ptsplitter);
		let billingid = csvid.slice(blsplitter);

		if (!isNaN(patientid as any) && !isNaN(billingid as any)) {
			patientid = parseInt(patientid) as any;
			billingid = parseInt(billingid) as any;
		}
		return { patientid: parseInt(patientid.toString()), billingid: parseInt(billingid) };
	}

	public async resultEntry(tenantId: number, requestBody: resultEntryType) {
		const { csvid, ptid, testid, fields, employeeid, comments, ascensionid, isScan, hasDrugs, drugs } = requestBody;

		if (!csvid || !ptid || !testid || !fields || (Array.isArray(fields) && fields.length == 0)) {
			return OperationsFailures.invalidResponseBodyParams;
		}

		let { billingid, patientid } = this.sanitize_patientid_billingid_query(csvid, ptid, "70,50");

		if (typeof billingid != "number" || typeof patientid != "number") {
			return OperationsFailures.invalidRequestBodyType;
		}

		await requireDailyQcAcceptance(tenantId, testid);

		const isPaymentStatusValid = await this.canPrintResult(tenantId, ascensionid);

		if (!isPaymentStatusValid) {
			throw new Error("Result entry not allowed for unpaid services");
		}

		const connection = await KnexConnection(tenantId);
		const calculationService = new CalculationFormulaService();
		const calculatedEntry = await calculationService.prepareResultEntry(tenantId, testid, ascensionid, fields as any[]);
		const entryFields = calculatedEntry.fields;
		const shouldCreateRecord = async function (tenantId: number, fieldid: number, ascensionId: number, testid: number): Promise<boolean> {
			const records = await promisifyQuery(tenantId, `SELECT * FROM test_results WHERE ascensionid = ? AND testid = ? AND fieldid = ?`, [
				ascensionId, testid, fieldid]);
			return Array.isArray(records) && records.length === 0;
		};


		const insertUpdate = async function (trx: any, tenantId: number, fields: any[], testid: number) {
			const cryptedValues = await resultEncrptionReferer(fields);
			if (!cryptedValues?.resources) throw new Error("Encryption failed");
			const { resources } = cryptedValues;
			const editSessionId = uuidv4();
			const isAdmin = await new RolesRepository(tenantId).getEmployeeRole(employeeid);
			if (isAdmin == undefined) throw new Error("Employee not found");
			const iswithinWindow = isAdmin.toLowerCase() === 'admin' ? true : await RequestAccess.verifyWindowPeriod(tenantId, ascensionid, employeeid, 'edit');

			await Promise.all(
				resources.map(async (item: any, index: number) => {
					const originalvalue = item.originalvalue;
					const isCreateRecord = await shouldCreateRecord(tenantId, item.fieldid, ascensionid, testid);
					if (isCreateRecord) {
						return await insertRecord();
					} else {
						return await updateRecord();
					}

					async function updateRecord() {
						if (!iswithinWindow) throw new Error("Edit window period has elapsed, you can no longer edit this result");
						const updateRecords = `UPDATE test_results SET value = ?,updated_on =Now(),employeeid = ?,entrymode = ?,originalvalue = ? ,field = ? ,edit_session_id = ? WHERE ascensionid = ? AND fieldid = ? AND testid = ?`;
						const result = await trx.raw(updateRecords, [item.value, employeeid, item?.entrymode || "manual", originalvalue, item.field, editSessionId, ascensionid, item.fieldid, testid]);
						await TestAscension.updateSampleAscensionstate(tenantId, ascensionid, 'resultEntryEnd', new Date(), employeeid);
						return rowAffected(result);
					}

					async function insertRecord() {
						const values = [item.field, billingid, patientid, item.value, employeeid, item?.entrymode || "manual", originalvalue, item.fieldid, testid, ascensionid, editSessionId];
						if (isScan) await TestAscension.updateSampleAscensionstate(tenantId, ascensionid, 'resultEntryStart', new Date(), employeeid);
						const query = `INSERT INTO test_results (field,billingid,patientid,value,employeeid,entrymode,originalvalue,fieldid,testid,ascensionid,edit_session_id)
							VALUES(?,?,?,?,?,?,?,?,?,?,?)`;
						const result = await trx.raw(query, values);
						await TestAscension.updateSampleAscensionstate(tenantId, ascensionid, 'resultEntryEnd', new Date(), employeeid);
						return rowAffected(result);
					}
				})
			);

			const pushCommentsQuery = `UPDATE result_comments SET comments = ? WHERE billingid = ? AND testid = ?`;

			const commentSection = async function () {
				const isRecordAvailable = await trx.raw(`SELECT * FROM result_comments WHERE testid = ? AND billingid = ?`, [
					testid,
					billingid,
				]);

				if (Array.isArray(isRecordAvailable[0]) && isRecordAvailable[0].length > 0) {
					const result = await trx.raw(pushCommentsQuery, [comments, billingid, testid]);
					return rowAffected(result);
				} else {
					const result = await trx.raw(`INSERT INTO result_comments (testid,billingid,comments) VALUES (?,?,?)`, [testid, billingid, comments]);
					return rowAffected(result);
				}
			};

			const isCommented = await commentSection();


			return isCommented;
		};


		async function drugProcessor() {
			if (hasDrugs) {
				if (!Array.isArray(drugs)) throw new Error('Culture and sensitivity drug results are required');
				let refinedDrugsArray = drugs.map((item) => { return { ...item, ascensionid, testid, sensitivity: item.sensitivity, drugid: item.id, reaction: item.sensitivity }; });
				let isDrugsInserted = await Creator.insertResultDrugReactionBulk(tenantId, ascensionid, testid, refinedDrugsArray as DrugSqlInsertion[]);
				if (isDrugsInserted) {
					await TestAscension.incrementTestEditCount(tenantId, billingid, ascensionid);
				} else {
					throw new Error('Unable to save culture and sensitivity drug results');
				}
			}

			if (!hasDrugs) {
				await TestAscension.incrementTestEditCount(tenantId, billingid, ascensionid);
			}
		}


		// Imaging results get a field-level audit trail. Classified server-side (never from the client's isScan flag).
		// ensureTable runs DDL, so it must happen before the transaction opens.
		const auditImaging = await ImagingResultAuditRepository.isImagingTest(connection, testid);
		if (auditImaging) await ImagingResultAuditRepository.ensureTable(tenantId);

		try {
			await connection.transaction(async (trx) => {
				let previousImagingValues: Record<string, string> = {};
				if (auditImaging) {
					const previousRows = await trx("test_results").select("fieldid", "value").where({ ascensionid, testid });
					previousRows.forEach((row: any) => {
						previousImagingValues[String(row.fieldid)] = ImagingResultAuditRepository.decryptStoredValue(row.value);
					});
				}

				await insertUpdate(trx, tenantId, entryFields, testid);

				if (auditImaging) {
					const nextValues: Record<string, string> = {};
					const fieldNames: Record<string, string> = {};
					(entryFields as any[]).forEach((item) => {
						if (!item?.fieldid || item.value === null || item.value === undefined || item.originalvalue === null || item.originalvalue === undefined) return;
						nextValues[String(item.fieldid)] = String(item.value);
						fieldNames[String(item.fieldid)] = String(item.field || `field#${item.fieldid}`);
					});
					await ImagingResultAuditRepository.record(
						trx,
						ImagingResultAuditRepository.diffFields(previousImagingValues, nextValues).map((change) => ({
							ascensionid, testid, patientid, billingid,
							entityType: "RESULT_FIELD" as const,
							entityId: change.fieldName,
							action: change.action,
							fieldName: fieldNames[change.fieldName] ?? change.fieldName,
							oldValue: change.oldValue,
							newValue: change.newValue,
							employeeid,
						}))
					);
				}
				await calculationService.recordCalculatedResults(trx, calculatedEntry.auditRecords, {
					testId: testid,
					billingId: billingid,
					patientId: patientid,
					ascensionId: ascensionid,
					employeeId: employeeid,
				});
				await drugProcessor();
				await TestAscension.systemLaboratoryByPass(tenantId, ascensionid, 'byPassValidation', employeeid, trx);
			});

			await CriticalValueEvaluator.criticalValueDetermination(tenantId, testid, billingid, ascensionid, entryFields, employeeid);

			// Fire-and-forget result value analytics processing
			const { ResultValueAnalyticsService } = await import("../result-value-analytics/ResultValueAnalyticsService");
			void ResultValueAnalyticsService.processCommittedResultEntry({
				tenantId,
				testid,
				ascensionid,
				patientid,
				fields: entryFields as Array<{ fieldid: number; originalvalue: string | null; value: string | null }>,
			}).catch((error) => console.error("Result value analytics processing failed", error));

			// Fire-and-forget test analytics pre-computation
			const { TestAnalyticsPreComputeService } = await import("../result-value-analytics/TestAnalyticsPreComputeService");
			void TestAnalyticsPreComputeService.recomputeTestAnalytics(tenantId, testid)
				.catch((error) => console.error("Test analytics pre-computation failed", error));

			return true;

		} catch (error) {
			throw error;
		}
	}

	async canPrintResult(tenantId: number, ascensionid: number): Promise<boolean> {
		const appSettings = await new ApplicationSettings().getAllAppSettings(tenantId);
		if (Number(appSettings?.allowPrintingUnpaid) === 1) return true;

		const connection = await KnexConnection(tenantId);
		const serviceRecord = await connection('dboservices AS ds')
			.innerJoin('test_ascension AS ta', 'ds.serviceid', 'ta.serviceid')
			.select('ds.paymentstatus')
			.where('ta.id', ascensionid)
			.first();

		return serviceRecord?.paymentstatus?.toLowerCase() === 'paid';
	}

	async getPrintableBillingAscensionIds(tenantId: number, billingid: number): Promise<number[]> {
		const appSettings = await new ApplicationSettings().getAllAppSettings(tenantId);
		const connection = await KnexConnection(tenantId);
		const query = connection('test_ascension AS ta')
			.leftJoin('dboservices AS ds', 'ds.serviceid', 'ta.serviceid')
			.where('ta.billingid', billingid)
			.select('ta.id');

		if (Number(appSettings?.allowPrintingUnpaid) !== 1) {
			query.whereRaw("LOWER(COALESCE(ds.paymentstatus, '')) = 'paid'");
		}

		const rows = await query;
		return rows.map((row: { id: number }) => row.id);
	}

	async getBillingIdByAscensionId(tenantId: number, ascensionid: number): Promise<number | null> {
		const connection = await KnexConnection(tenantId);
		const row = await connection('test_ascension').select('billingid').where({ id: ascensionid }).first();
		return row?.billingid ?? null;
	}

	protected static async logCriticalValue(tenantId: number, testid: number, billingid: number, statement: string, employeeid: number): Promise<boolean> {
		const result = await promisifyQuery(tenantId, insert_critical_value_alert, [billingid, testid, statement, employeeid]);
		return rowAffected(result);
	}



	private static async createUltrasoundScanTemplateMapper(tenantId: number, template: ultrasoundTemplateMapper): Promise<number | boolean> {
		const { employeeid, name, testid, visibleToAll, associatedbodypart } = template;
		const insert = await promisifyQuery(tenantId, q_insert_new_ultrasound_template_mapper, [testid, name, employeeid, visibleToAll, associatedbodypart]);
		return insert.insertId ? parseInt(insert.insertId) : false;
	}

	private static async updateUltrasoundScanTemplateMapper(tenantId: number, template: ultrasoundTemplateMapper) {
		const { employeeid, name, testid, visibleToAll, associatedbodypart, keyid } = template;
		const updateRow = await promisifyQuery(tenantId, q_update_ultrasound_template_mapper, [name, employeeid, visibleToAll, associatedbodypart, keyid]);
		return rowAffected(updateRow);
	}


	public static async createUltrasoundTemplate(tenantId: number, template: ultrasoundTemplate) {
		try {
			const { fields } = template;
			const templateId = await this.createUltrasoundScanTemplateMapper(tenantId, template);

			if (typeof templateId !== "number") return false;

			if (Array.isArray(fields) && fields.length > 0) {
				for (let i = 0; i < fields.length; i++) {
					const { name, value, id } = fields[i];
					await promisifyQuery(tenantId, q_insert_ultrasound_template, [templateId, name, value, id]);
				}
			}

			return true;
		} catch (error) {
			console.error("Error creating ultrasound template:", error);
			return false;
		}
	}



	public static async updateUltrasoundTemplate(tenantId: number, template: ultrasoundTemplate) {
		const { fields, keyid } = template;
		if (!keyid) return OperationsFailures.invalidRequestBodyType;
		const isUpdated = await this.updateUltrasoundScanTemplateMapper(tenantId, template);
		if (!isUpdated) return OperationsFailures.queryExecutionFailed;

		if (Array.isArray(fields) && fields.length > 0) {

			for (let i = 0; i < fields.length; i++) {
				const { field, value } = fields[i];
				const hasField = await this.hasUltrasoundTemplateField(tenantId, keyid, field as string);

				if (hasField) {
					await promisifyQuery(tenantId, q_update_ultrasound_template, [field, value, keyid, field]);
				} else {
					await promisifyQuery(tenantId, q_insert_ultrasound_template, [keyid, field, value]);
				}
			}
		}
		return true;
	}

	private static async getUltrasoundTemplateField(tenantId: number, templateid: number, fieldName: string) {
		const result = await promisifyQuery(tenantId, q_get_ultrasound_template_field, [templateid, fieldName]);
		if (result.length === 0) return null;
		return result;
	}

	private static async hasUltrasoundTemplateField(tenantId: number, templateid: number, fieldName: string) {
		const result = await this.getUltrasoundTemplateField(tenantId, templateid, fieldName);
		if (result === null) return false;
		return result.length > 0
	}

	private static async getUltrasoundTemplate(tenantId: number, templateId: number) {
		const result = await promisifyQuery(tenantId, q_get_a_single_ultrasound_template, [templateId]);
		return result;
	}

	public static async getUltrasoundTypeTemplates(tenantId: number, testid: number, count: number, page: number, employeeid: number) {
		return await paginationQuery({ count, page }, q_get_ultrasound_template_mapper_scan_type, [employeeid, testid], tenantId);
	}


	private static async getUltrasoundTemplateMapper(tenantId: number, templateid: number) {
		const result = await promisifyQuery(tenantId, q_get_a_single_ultrasound_mapper, [templateid]);
		if (result.length === 0) return null;
		return result[0];
	}

	public static async getUltrasoundTemplateSingleDetail(tenantId: number, templateid: number) {
		const template = await this.getUltrasoundTemplateMapper(tenantId, templateid);
		template.fields = await this.getUltrasoundTemplate(tenantId, templateid);
		return template;
	}
	public static async getUltrasoundTemplatesAll(tenantId: number, count: number, page: number, employeeid: number) {
		return await paginationQuery({ count, page }, q_get_ultrasound_template_mapper, [employeeid], tenantId);
	}



	public static async getResultDrugReactions(tenantId: number, ascensionId: number, testid: number): Promise<[]> {
		return await promisifyQuery(tenantId, q_get_drug_reaction_inserts_find, [testid, ascensionId]);
	}
	private static async updateResultDrugReactions(tenantId: number, reaction: string, ascensionId: number, testid: number): Promise<boolean> {
		let result = await promisifyQuery(tenantId, q_update_drug_reaction
			, [reaction, ascensionId, testid]);
		return rowAffected(result);
	}

	private static async hasResultDrugreactions(tenantId: number, ascensionId: number, testid: number, drugid: number) {
		const packets = await promisifyQuery(tenantId, q_has_drug_reaction_inserts, [testid, ascensionId, drugid])
		return packets.length > 0;
	}

	private static async insertResultDrugReaction(tenantId: number, drugRxn: DrugSqlInsertion): Promise<boolean> {
		const connection = await KnexConnection(tenantId);
		try {
			const { drugid, sensitivity, ascensionid, testid } = drugRxn
			const reaction = sensitivity ?? '';
			const record = await connection.raw(`SELECT * FROM resultentrydrugsreaction WHERE ascensionid = ? AND testid = ? AND drugid = ? `, [ascensionid, testid, drugid]);
			const hasRecord = Array.isArray(record[0]) ? record[0].length > 0 : false;
			if (hasRecord) {
				await connection.raw(`UPDATE resultentrydrugsreaction SET reaction = ? WHERE ascensionid = ? AND testid = ? AND drugid = ?`, [reaction, ascensionid, testid, drugid]);
				return true;
			} else {
				await connection.raw(`INSERT INTO resultentrydrugsreaction (drugid, reaction, ascensionid, testid) VALUES (?, ?, ?, ?)`, [drugid, reaction, ascensionid, testid]);
				return true;
			}
		} catch (error) {
			console.error('Error inserting drug reaction:', error);
			return false;
		}
	}

	private static async insertResultDrugReactionBulk(
		tenantId: number,
		ascensionId: number,
		testId: number,
		drugs: DrugSqlInsertion[]
	): Promise<boolean> {
		const insertPromises = drugs.map((item) =>
			this.insertResultDrugReaction(tenantId, item)
		);
		const results = await Promise.allSettled(insertPromises);
		const hasErrorOccurred = results.some((result) => result.status === 'rejected' || !result.value);
		if (hasErrorOccurred) return false;

		const deletion = buildStaleDrugReactionDelete(ascensionId, testId, drugs.map((drug) => drug.drugid));
		await promisifyQuery(tenantId, deletion.query, deletion.params);
		return true;
	}


}
type DrugSqlInsertion = {
	ascensionid: number, reaction?: string, testid: number, drugid: number, sensitivity?: 'resistant' | 'sensitive' | 'Resistant' | 'Sensitive' | ''
}
type fieldConstraints = { value: (string | number), constraint: number, valueAlert: number, prefix: number, suffix: number, alert: number, replacementText: string }

interface ultrasoundTemplateMapper {
	testid: number,
	visibleToAll: number,
	employeeid: number,
	associatedbodypart: string,
	keyid?: number,
	name: string,
}

interface ultrasoundTemplate extends ultrasoundTemplateMapper {
	fields: { name?: string, value: string, field?: string, id: number }[]
}


export const CONSTRAINTSLEVEL = [
	{ value: 0, description: 'select an option here', symbol: '' },
	{ value: 1, description: 'less than value', symbol: '<' },
	{ value: 2, description: 'greater than value', symbol: '>' },
	{ value: 3, description: 'match value', symbol: '=' },
	{ value: 4, description: 'does not match value', symbol: '≠' }
];


export const ALERT_OPTIONS = {
	0: 'select an option below',
	1: 'alert',
	2: 'do not alert',
	3: 'replace value with custom text'
};