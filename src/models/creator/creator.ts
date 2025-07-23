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
import { NewRegistration } from "../registration/types";
import { promisifyQuery, rowAffected, paginationQuery } from "../../hooks/helper";
import { CreationRule, resultEntryTemplateView, previewReportView, resultEntryType } from "./creator.d.type";
import resultEncrptionReferer from "./resultEncryptionReferer";
import TestCreationRulesRepository, { TestCreationRule } from "../TestCreation/TestCreationRulesRepository";
import { CriticalValueEvaluator } from './CriticalValueEvaluator';

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
	async getPreviousRecordsOrCreationRule(tenantId: number, testid: number, billingid: number, patientid: number
	): Promise<TestCreationRule[] | null | undefined> {
		try {
			const [previousRecords, creationRules] = await Promise.all([
				this.getPreviousRecords(tenantId, testid, billingid, patientid),
				new TestCreationRulesRepository(tenantId).findByTestId(testid)
			]);

			if (previousRecords.length === 0) return creationRules;
			if (previousRecords.length > 0 && creationRules.length > 0) {
				const mappings = previousRecords.map(item => {
					const matchingRule = creationRules.find(rule => rule.id === item.fieldid);
					return matchingRule ? { ...matchingRule, ...item } : null;
				});

				return mappings.filter(Boolean)
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
		const patientdata: NewRegistration = await new Registration().getPatientBasicData(tenantId, patientid);
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
			if (previousRecords.length === 0) return { result: [], testname: null, hasDrugs: false };
			hasDrugs = await this.hasDrugAssociatedWithTest(tenantId, testid, hasDrugs);
			return { result: previousRecords, testname, hasDrugs }
		} catch (err) {
			throw err;
		}
	}

	async getCustomPreviousRecords(tenantId: number, testid: number, billingid: number, patientid: number): Promise<resultEntryTemplateView | string> {
		try {
			let hasDrugs = false;

			const parsedBillingid = parseInt(billingid.toString());
			const parsedPatientid = parseInt(patientid.toString());
			const testname = await testpanel.getTestUsingTestid(tenantId, testid);
			if (!testname) return OperationsFailures.unfoundID;

			let previousRecords = await this.getPreviousRecordsWithTestRuleMapped(tenantId, testid, parsedBillingid, parsedPatientid);
			if (!Array.isArray(previousRecords) || previousRecords.length === 0) return { result: [], testname: null, hasDrugs: false };

			const testDetails = await testpanel.getTestDetails(tenantId, testid);
			hasDrugs = await this.hasDrugAssociatedWithTest(tenantId, testid, hasDrugs);
			const hasGenderVariation = testDetails ? testDetails['hasGenderVariation'] : false;

			let clientGender = "";
			if (hasGenderVariation) {
				const packet = await promisifyQuery(tenantId, getGenderQuery, [patientid]);
				if (packet.length > 0) clientGender = packet[0]["gender"];
			}


			if (hasGenderVariation && clientGender) {
				previousRecords = previousRecords.map((item) => {
					const obj: any = { ...item };
					if (item[clientGender]) {
						obj.upperlimit = item[clientGender].upperlimit;
						obj.lowerlimit = item[clientGender].lowerlimit;
						delete obj.female;
						delete obj.male;
					}
					return obj;
				});
			}

			return { testname, result: previousRecords, hasDrugs }
		} catch (err) {
			throw err;
		}
	}

	async resultPresentationView(tenantId: number, testid: number, billingid: number, patientid: number): Promise<previewReportView | [] | string> {
		const resultDataset = await this.getCustomPreviousRecords(tenantId, testid, billingid, patientid);
		if (typeof resultDataset == "string") return resultDataset
		const { result, hasDrugs, testname } = resultDataset

		if (result && Array.isArray(result) && result.length > 0) {
			let resultOmissionMaleFemale = result.map((item: CreationRule, index: number) => {
				index === 2 && console.log(item, 'item')
				const { female, male, isValueTracked, type, valueAlert, useplain, alert, constraint,
					...rest } = item;
				return rest;
			})
			return {
				result: resultOmissionMaleFemale,
				hasDrugs,
				testname
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

		const shouldCreateRecord = async function (tenantId: number, field: string, ascensionId: number) {
			const records = await promisifyQuery(tenantId, `SELECT * FROM test_results WHERE ascensionid = ? AND field = ?`, [
				ascensionId, field
			]);
			return Array.isArray(records) && records.length === 0;
		};




		const insertUpdate = async function (tenantId: number, fields: any[]) {
			const { resources } = await resultEncrptionReferer(fields);
			const insertAll = await Promise.all(
				resources.map(async (item: any, index: number) => {
					const originalvalue = item.originalvalue;
					const isCreateRecord = await shouldCreateRecord(tenantId, item.field, ascensionid)
					if (isCreateRecord) {
						const values = [item.field, billingid, patientid, item.value, employeeid, item?.entrymode || "manual", originalvalue, item.fieldid, testid, ascensionid];
						if (isScan) {
							await TestAscension.updateSampleAscensionstate(tenantId, ascensionid, 'resultEntryStart', new Date(), employeeid);
						}

						const query = `INSERT INTO test_results (field,billingid,patientid,value,employeeid,entrymode,originalvalue,fieldid,testid,ascensionid) 
						VALUES(?,?,?,?,?,?,?,?,?,?)`;
						await TestAscension.updateSampleAscensionstate(tenantId, ascensionid, 'resultEntryEnd', new Date(), employeeid);
						return rowAffected(await promisifyQuery(tenantId, query, values));
					} else {
						const updateRecords = `UPDATE test_results SET value = ?,updated_on =Now(),employeeid = ?,entrymode = ?,originalvalue = ? ,fieldid = ? WHERE ascensionid = ? AND field = ?`;

						const result = await promisifyQuery(tenantId, updateRecords, [item.value, employeeid, item?.entrymode, originalvalue, item.fieldid, ascensionid, item.field, testid]);
						await TestAscension.updateSampleAscensionstate(tenantId, ascensionid, 'resultEntryEnd', new Date(), employeeid);
						return rowAffected(result);
					}
				})
			);


			const isAllInserted = insertAll.some((a, i) => a == false);

			const pushCommentsQuery = `UPDATE result_comments SET comments = ? WHERE billingid = ? AND testid = ?`;

			const commentSection = async function () {
				const isRecordAvailable = await promisifyQuery(tenantId, `SELECT * FROM result_comments WHERE testid = ? AND billingid = ?`, [
					testid,
					billingid,
				]);

				if (isRecordAvailable.length > 0) {
					return rowAffected(await promisifyQuery(tenantId, pushCommentsQuery, [comments, billingid, testid]));
				} else {
					return rowAffected(
						await promisifyQuery(tenantId, `insert into result_comments (testid,billingid,comments) VALUES (?,?,?)`, [testid, billingid, comments])
					);
				}
			};

			const isCommented = await commentSection();

			return isAllInserted === false && isCommented;
		};

		if (hasDrugs && drugs.length > 0) {
			let refinedDrugsArray = drugs.map((item, index) => { return { ...item, ascensionid, testid, reaction: item.sensitivity, drugid: item.id } });
			let isDrugsInserted = await Creator.insertResultDrugReactionBulk(tenantId, refinedDrugsArray);
			if (isDrugsInserted) {
				await TestAscension.incrementTestEditCount(tenantId, billingid, ascensionid);
			}
		}
		if (!hasDrugs) {
			await TestAscension.incrementTestEditCount(tenantId, billingid, ascensionid);
		}
		const criticalcallout = await CriticalValueEvaluator.criticalValueDetermination(tenantId, testid, billingid, ascensionid, fields, employeeid);
		return !isScan ? await insertUpdate(tenantId, fields) : await insertUpdate(tenantId, criticalcallout);

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

		const isUpdated = await this.updateUltrasoundScanTemplateMapper(tenantId, template);

		if (!isUpdated) return OperationsFailures.queryExecutionFailed;

		if (Array.isArray(fields) && fields.length > 0) {

			for (let i = 0; i < fields.length; i++) {
				const { field, value } = fields[i];
				const hasField = await this.hasUltrasoundTemplateField(tenantId, keyid, field);

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
		const { drugid, reaction, ascensionid, testid } = drugRxn
		const hasRxn = await this.hasResultDrugreactions(tenantId, ascensionid, testid, drugid);

		if (!hasRxn) {
			const result = await promisifyQuery(tenantId, q_insert_drug_reaction, [drugid, reaction, ascensionid, testid]);
			return rowAffected(result);
		} else {
			return await this.updateResultDrugReactions(tenantId, reaction, ascensionid, testid);
		}

	}

	private static async insertResultDrugReactionBulk(
		tenantId: number,
		drugs: DrugSqlInsertion[]
	): Promise<boolean> {
		const insertPromises = drugs.map((item) =>
			this.insertResultDrugReaction(tenantId, item)
		);
		const results = await Promise.allSettled(insertPromises);
		const hasErrorOccurred = results.some((res) => res.status === 'rejected');
		return !hasErrorOccurred;
	}


}
type DrugSqlInsertion = {
	ascensionid: number, reaction: string, testid: number, drugid: number
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