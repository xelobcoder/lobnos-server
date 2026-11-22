import { evaluateCriticalActions } from '../operations/CriticalActionService';
import { allowsUnpaidResultAction, isPaidResultService } from '../operations/ResultPaymentPolicy';
import { invalidateResultApprovals } from '../operations/ResultApprovalService';
import { testpanel } from "../../testpanel/testpanelList";
import { LaboratoryWorkflowService } from "../operations/LaboratoryWorkflow";
import {
	getGenderQuery, insert_critical_value_alert,
	modify_ultrasound_field_to_support_long_text,
	q_comments_query,
	q_get_a_single_ultrasound_mapper,
	q_get_a_single_ultrasound_template,
	q_get_drug_reaction_inserts_find,
	q_get_test_ascension_name_and_id,
	q_get_ultrasound_template_mapper,
	q_get_ultrasound_template_mapper_scan_type,
	q_has_drug_reaction_inserts,
	q_insert_drug_reaction,
	q_update_drug_reaction,
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
import { InstrumentMaintenanceService } from '../QualityControl/InstrumentMaintenanceService';
import { buildStaleDrugReactionDelete } from './resultDrugReactions';
import { PrimeLimsTabletest_results } from "../../database/DatabaseTableSchema";
import RequestAccess from "../security/RequestAcessResult/requestAcess";
import RolesRepository from "../settings/users/RolesRepository";
import ImagingResultAuditRepository from "../operations/imaging/ImagingResultAuditRepository";
import ApplicationSettings from "../application/appsettings/appset";
import { applyDemographicLimits, getAgeGroup } from "./demographic-limits";
import { UltrasoundTemplateInput, UltrasoundTemplateRepository } from "../operations/imaging/UltrasoundTemplateRepository";
import { beginResultSave, recordResultSaveRequest, resultSaveHasChanges, validateResultFields } from './ResultSaveGuard';
import { ManualParameterRerunService } from '../operations/ManualParameterRerunService';

export default class Creator {
	resultSaveChanged = false;
	resultSaveReplayed = false;
	resultSaveStaged = false;
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
		this.resultSaveChanged = false;
		this.resultSaveReplayed = false;
		this.resultSaveStaged = false;
		validateResultFields(fields);

		if (!csvid || !ptid || !testid || !fields || (Array.isArray(fields) && fields.length == 0)) {
			return OperationsFailures.invalidResponseBodyParams;
		}

		let { billingid, patientid } = this.sanitize_patientid_billingid_query(csvid, ptid, "70,50");

		if ([billingid, patientid, testid, ascensionid, employeeid].some(value =>
			!Number.isSafeInteger(Number(value)) || Number(value) <= 0))
			throw Object.assign(new Error('Valid ordered test, patient, billing, test and actor identities are required'), { statusCode: 400 });

		await new LaboratoryWorkflowService(tenantId).requireResultEntry(ascensionid, testid, billingid, patientid);
		if (!await this.canEnterResult(tenantId, Number(ascensionid))) {
			throw Object.assign(new Error('Result entry is disabled for unpaid services. Complete payment before saving results.'), {
				statusCode: 403, code: 'UNPAID_RESULT_ENTRY_DISABLED',
			});
		}
		const qcConnection = await KnexConnection(tenantId);
          const qcBill = await qcConnection('billing').where({ billingid }).first('branchid');
          const qcWork = await qcConnection('lab_work_assignments').where({ ascensionid }).first('device_id');
          await requireDailyQcAcceptance(tenantId, testid, { branchid: Number(qcBill?.branchid), deviceId: qcWork?.device_id || null });

		const connection = await KnexConnection(tenantId);
		const calculationService = new CalculationFormulaService();
          let entryFields = fields as any[];
		const insertUpdate = async function (trx: any, tenantId: number, fields: any[], testid: number) {
			// Encrypt the two scalar values independently, including an empty display
			// with a nonempty original. Never coerce an encryption failure to blank data.
			const resources = fields.map(item => ({
				...item, value: encrypt_value(String(item.value)), originalvalue: encrypt_value(String(item.originalvalue)),
			}));
			const editSessionId = uuidv4();
			const isAdmin = await new RolesRepository(tenantId).getEmployeeRole(employeeid);
			if (isAdmin == undefined) throw new Error("Employee not found");
			const iswithinWindow = isAdmin.toLowerCase() === 'admin' ? true : await RequestAccess.verifyWindowPeriod(tenantId, ascensionid, employeeid, 'edit');

			// Serialize parameter writes under the ordered-test lock. Never fan out a
			// check-then-insert for repeated IDs; validation and the unique index agree.
			for (const item of resources) {
				const key = { ascensionid, testid, fieldid: Number(item.fieldid) };
				const prior = await trx('test_results').where(key).first();
				const values = {
					field: item.field, value: item.value, originalvalue: item.originalvalue,
					employeeid, entrymode: item.entrymode || 'manual', edit_session_id: editSessionId,
				};
				if (prior) {
					if (!iswithinWindow) throw new Error("Edit window period has elapsed, you can no longer edit this result");
					await trx('test_results').where(key).update({ ...values, updated_on: new Date() });
				} else {
					if (isScan) await TestAscension.updateSampleAscensionstate(tenantId, ascensionid, 'resultEntryStart', new Date(), employeeid, trx);
					await trx('test_results').insert({ ...key, ...values, billingid, patientid });
				}
				await TestAscension.updateSampleAscensionstate(tenantId, ascensionid, 'resultEntryEnd', new Date(), employeeid, trx);
			}
			const key = { billingid, testid };
			const priorComment = await trx('result_comments').where(key).first();
			if (priorComment) await trx('result_comments').where(key).update({ comments: comments ?? '' });
			else await trx('result_comments').insert({ ...key, comments: comments ?? '' });
		};


		async function drugProcessor(trx: any) {
			if (hasDrugs) {
				if (!Array.isArray(drugs)) throw new Error('Culture and sensitivity drug results are required');
				let refinedDrugsArray = drugs.map((item) => { return { ...item, ascensionid, testid, sensitivity: item.sensitivity, drugid: item.id, reaction: item.sensitivity }; });
				let isDrugsInserted = await Creator.insertResultDrugReactionBulk(tenantId, ascensionid, testid, refinedDrugsArray as DrugSqlInsertion[], trx);
				if (isDrugsInserted) {
					await TestAscension.incrementTestEditCount(tenantId, billingid, ascensionid, trx);
				} else {
					throw new Error('Unable to save culture and sensitivity drug results');
				}
			}

			if (!hasDrugs) {
				await TestAscension.incrementTestEditCount(tenantId, billingid, ascensionid, trx);
			}
		}


		// Imaging results get a field-level audit trail. Classified server-side (never from the client's isScan flag).
		// ensureTable runs DDL, so it must happen before the transaction opens.
		const auditImaging = await ImagingResultAuditRepository.isImagingTest(connection, testid);
		if (auditImaging) await ImagingResultAuditRepository.ensureTable(tenantId);

		try {
			const context = { ascensionid: Number(ascensionid), testid: Number(testid), billingid, patientid, employeeid: Number(employeeid) };
			await connection.transaction(async (trx) => {
                    const save = await beginResultSave(trx, context, requestBody);
                    if (save.replayed) { this.resultSaveReplayed = true; return; }
                    if (await new ManualParameterRerunService(tenantId).stageAnalyzerResults(
                         trx, Number(ascensionid), Number(testid), fields as any[], Number(employeeid),
                    )) {
                         const rerunWork = await trx('lab_work_assignments').where({ ascensionid }).forUpdate().first('device_id');
                         await new InstrumentMaintenanceService(tenantId).assertInstrumentClear(trx, rerunWork?.device_id);
                         this.resultSaveStaged = true;
                         return;
                    }
                    if (!await this.canEnterResult(tenantId, Number(ascensionid), trx)) {
                         throw Object.assign(new Error('Result entry is disabled for unpaid services. Complete payment before saving results.'), {
                              statusCode: 403, code: 'UNPAID_RESULT_ENTRY_DISABLED',
                         });
                    }
                    await trx('test_panels').where({ id: testid }).forUpdate().first();
                    const calculatedEntry = await calculationService.prepareResultEntry(tenantId, testid, ascensionid, fields as any[], trx);
                    entryFields = calculatedEntry.fields;
                    const changed = await resultSaveHasChanges(trx, context, requestBody, entryFields, save.rows);
                    if (!changed) {
                         await recordResultSaveRequest(trx, context, requestBody, save.hash);
                         return;
                    }
                    const revision = await trx('dbotestresultapproval').where({ ascensionid }).first();
                    if (requestBody.expected_revision !== undefined &&
                         (!Number.isSafeInteger(requestBody.expected_revision) || requestBody.expected_revision !== Number(revision?.approval_revision || 0)))
                         throw Object.assign(new Error('The result has changed. Reload and review the current result before saving your edits.'), { statusCode: 409 });
                    const currentQcWork = await trx('lab_work_assignments').where({ ascensionid }).first('device_id');
                    await new InstrumentMaintenanceService(tenantId).assertInstrumentClear(trx, currentQcWork?.device_id);
                    await requireDailyQcAcceptance(tenantId, testid, { branchid: Number(qcBill?.branchid), deviceId: currentQcWork?.device_id || null }, trx);
                    await invalidateResultApprovals(trx, ascensionid, employeeid);
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
				await drugProcessor(trx);
				await TestAscension.systemLaboratoryByPass(tenantId, ascensionid, 'byPassValidation', employeeid, trx);
                    await evaluateCriticalActions(trx, { testid, ascensionid, billingid, employeeid }, entryFields);
                    await recordResultSaveRequest(trx, context, requestBody, save.hash);
                    this.resultSaveChanged = true;
			});

			// Critical findings and holds were saved atomically with the result revision.
			if (!this.resultSaveChanged) return true;

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

	async canEnterResult(tenantId: number, ascensionid: number, transaction?: any): Promise<boolean> {
		const settings = transaction
			? await transaction('applicationsettings').forShare().first('allowResultEnteringUpaid')
			: await new ApplicationSettings().getAllAppSettings(tenantId);
		if (allowsUnpaidResultAction(settings, 'entry')) return true;
		const connection = transaction || await KnexConnection(tenantId);
		const query = connection('dboservices AS ds')
			.innerJoin('test_ascension AS ta', 'ds.serviceid', 'ta.serviceid')
			.select('ds.paymentstatus')
			.where('ta.id', ascensionid);
		if (transaction) query.forUpdate();
		const service = await query.first();
		return isPaidResultService(service?.paymentstatus);
	}

	async canPrintResult(tenantId: number, ascensionid: number): Promise<boolean> {
		const appSettings = await new ApplicationSettings().getAllAppSettings(tenantId);
		if (allowsUnpaidResultAction(appSettings, 'print')) return true;

		const connection = await KnexConnection(tenantId);
		const serviceRecord = await connection('dboservices AS ds')
			.innerJoin('test_ascension AS ta', 'ds.serviceid', 'ta.serviceid')
			.select('ds.paymentstatus')
			.where('ta.id', ascensionid)
			.first();

		return isPaidResultService(serviceRecord?.paymentstatus);
	}

	async getPrintableBillingAscensionIds(tenantId: number, billingid: number): Promise<number[]> {
		const appSettings = await new ApplicationSettings().getAllAppSettings(tenantId);
		const connection = await KnexConnection(tenantId);
		const query = connection('test_ascension AS ta')
			.leftJoin('dboservices AS ds', 'ds.serviceid', 'ta.serviceid')
			.leftJoin('test_panels AS tp', 'tp.id', 'ta.testid')
			.leftJoin('departments AS dp', 'dp.id', 'tp.category')
			.where('ta.billingid', billingid)
			.whereRaw("(dp.department IS NULL OR LOWER(TRIM(dp.department)) <> 'ultrasound')")
			.select('ta.id');

		if (!allowsUnpaidResultAction(appSettings, 'print')) {
			query.whereRaw("LOWER(TRIM(COALESCE(ds.paymentstatus, ''))) = 'paid'");
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



	public static async createUltrasoundTemplate(tenantId: number, template: UltrasoundTemplateInput) {
		return new UltrasoundTemplateRepository(tenantId).create(template);
	}

	public static async updateUltrasoundTemplate(tenantId: number, template: UltrasoundTemplateInput & { keyid: number }) {
		return new UltrasoundTemplateRepository(tenantId).update(template);
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
		if (!template) return null;
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
		drugs: DrugSqlInsertion[], trx?: any
	): Promise<boolean> {
		if (trx) {
               for (const item of drugs) {
                    const key = { ascensionid: ascensionId, testid: testId, drugid: item.drugid };
                    const prior = await trx('resultentrydrugsreaction').where(key).first();
                    if (prior) await trx('resultentrydrugsreaction').where(key).update({ reaction: item.sensitivity ?? '' });
                    else await trx('resultentrydrugsreaction').insert({ ...key, reaction: item.sensitivity ?? '' });
               }
               const deletion = buildStaleDrugReactionDelete(ascensionId, testId, drugs.map(item => item.drugid));
               await trx.raw(deletion.query, deletion.params);
               return true;
          }
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
