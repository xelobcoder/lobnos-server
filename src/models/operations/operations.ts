import { LaboratoryWorkflowService } from "./LaboratoryWorkflow";
import {
     q_approved_samples,
     q_billing_test_collection,
     q_checkbillingid,
     q_entered_result_part,
     q_get_all_entered_result,
     q_get_all_result_entry_base,
     q_get_all_result_entry_ultrasound_base,
     q_get_all_test_ready_for_various_stages_ultrasound,
     q_get_all_test_preview,
     q_get_all_test_ready_for_various_stages,
     q_log_result_entry,
     q_qualifiedToProcessByDepartment,
     q_ultrasound_waitingList,
} from "./queries";
import { ascensionStageRequestQueryTypes, OperationsFailures, OperationsFilterResultEntry, resultQuery } from "./types";
import { promisifyQuery, rowAffected, paginationQuery } from "../../hooks/helper";
import { TestApprovalClass } from "./testApprovalClass";
import ImagingResultAuditRepository from "./imaging/ImagingResultAuditRepository";
import KnexConnection from "../../database/KnexConnections";
import ApplicationSettings from "../application/appsettings/appset";

export default class Operations {
     private billingid: number;

     constructor(billingid: number) {
          this.billingid = billingid;
     }

     async isvalidBillingid(tenantId: number): Promise<boolean> {
          const result = await promisifyQuery(tenantId, q_checkbillingid, [this.billingid]);
          return result.length === 0;
     }

     async readyforTest(tenantId: number): Promise<boolean | string | undefined> {
          const validId = await this.isvalidBillingid(tenantId);
          if (!validId) {
               return "Invalid billingid";
          }
          if (validId) {
               const result = await promisifyQuery(tenantId, q_approved_samples, [this.billingid]);
               return !(result.length === 0);
          }

          return undefined;
     }

     public async getLaboratoryTestReadyForResultEntry(
          tenantId: number,
          departmentid: number | string,
          branchid: number,
     ): Promise<[] | string> {
          const certified = await this.readyforTest(tenantId);
          if (!certified) return OperationsFailures.notready;

          if (!departmentid || (typeof departmentid == "string" && departmentid != "all")) {
               throw new Error("departmentid not provided or wrong format provided");
          }

          const values = [];
          let queryString = q_billing_test_collection;

          if (typeof departmentid == "number") {
               queryString += ` AND tp.category =  ?`;
               values.push(departmentid);
          }

          queryString += ` AND ta.collection = 'true' AND ta.ready='false'  AND d.department <> 'ultrasound' `;
          return await promisifyQuery(tenantId, queryString, values);
     }

     public async getAllQualifiedToProcessByDepartment(
          tenantId: number,
          category: number | string,
          count: number,
          page: number,
          branchid: number,
     ): Promise<[]> {
          try {
               let queryString = q_qualifiedToProcessByDepartment;
               const values = [];
               if (category != "all") {
                    queryString += ` AND tp.category = ?`;
                    values.push(category);
               }
               values.push(count);
               values.push(page - 1 * count);
               queryString += ` AND ta.collection = 'true' AND ta.ready='false' AND d.department <> 'ultrasound' 
	  GROUP BY np.patientid ORDER BY b.billingid ASC LIMIT ? OFFSET ?`;
               return await promisifyQuery(tenantId, queryString, values);
          } catch (error) {
               throw error;
          }
     }

     logResultEntryIntoAscensionTable = async (
          tenantId: number,
          testid: number,
          billingid: number,
     ): Promise<boolean> => {
          const isResultEntryLogged = await promisifyQuery(tenantId, q_log_result_entry, [billingid, testid]);
          return rowAffected(isResultEntryLogged);
     };

     async getAllCasesResultEntryByMany(tenantId: number, requestQuery: OperationsFilterResultEntry): Promise<any[]> {
          const {
               fullname,
               count = 10,
               page = 1,
               departmentid,
               testid,
               status,
               from,
               to,
               billingid,
               branchid,
          } = requestQuery;

          try {
               var { conditions, finalQuery }: { conditions: (string | Date)[]; finalQuery: string } =
                    await Operations.generateAscensionQuery({
                         from,
                         to,
                         stage: null,
                         isUltrasound: false,
                         organizationId: null,
                         clinicianId: null,
                    });

               if (fullname) {
                    conditions.push(`CONCAT(np.firstname, ' ', np.middlename, ' ', np.lastname) LIKE ?`);
               }

               if (departmentid && departmentid !== "all") {
                    conditions.push(`tp.category = ?`);
                    // values.push(departmentid);
               }

               if (testid && !isNaN(testid)) {
                    conditions.push(`ta.testid = ?`);
                    // values.push(testid);
               }

               if (from && to) {
                    conditions.push(`DATE(b.billedon) BETWEEN ? AND ?`);
                    // values.push(from, to);
               } else if (from) {
                    conditions.push(`DATE(b.billedon) BETWEEN ? AND CURRENT_DATE`);
                    // values.push(from);
               }

               if (billingid) {
                    conditions.push(`b.billingid = ?`);
                    // values.push(billingid);
               }
               if (conditions.length > 0) {
                    finalQuery += ` AND ${conditions.join(" AND ")} `;
               }

               finalQuery += `
					ORDER BY b.billingid DESC
					LIMIT ? OFFSET ?
				`;

               return await paginationQuery({ count, page }, finalQuery, [], tenantId);
          } catch (err) {
               throw err;
          }
     }

     public static async getAscensionOverViewModel(
          tenantid: number,
          filters?: {
               billingid?: number;
               patientid?: number;
               _dateFrom?: string;
               _dateEnd?: string;
               testname?: number;
               patientname?: string;
          },
     ): Promise<any> {
          try {
               const params: any[] = [];
               let whereConditions = `WHERE (d.department IS NULL OR LOWER(d.department) <> 'ultrasound') AND rf.isRefundCompleted = 0 AND dbo.status <> 'voided' AND dbo.status <> 'refunded'`;

               if (filters?._dateFrom && filters._dateFrom !== "all") {
                    whereConditions += ` AND DATE(b.billedon) BETWEEN ? AND ?`;
                    params.push(filters._dateFrom);
                    params.push(filters._dateEnd);
               }

               if (filters?.billingid) {
                    whereConditions += ` AND b.billingid = ?`;
                    params.push(filters.billingid);
               }

               if (filters?.patientid) {
                    whereConditions += ` AND p.patientid = ?`;
                    params.push(filters.patientid);
               }

               if (filters?.testname) {
                    whereConditions += ` AND tp.id = ?`;
                    params.push(filters.testname);
               }

               if (filters?.patientname) {
                    whereConditions += ` AND REGEXP_REPLACE(
					LOWER(CONCAT_WS(' ', p.firstname, p.middlename, p.lastname)),
					'[[:space:]]+',
					' '
					) LIKE ?`;
                    params.push(`%${filters.patientname.toLowerCase().trim().replace(/\s+/g, " ")}%`);
               }

               const query = `
									SELECT 
						p.patientid,
						CONCAT(
							p.fullpatientid, ' | ',
							p.firstname, ' ', p.lastname, ' | ',
							p.gender, ' | ',
							p.age, ' ', p.agetype
						) AS patient_details,

						b.billingid,
						b.billedon,
						b.clientstatus AS payment_status,
						MIN(ta.ascension_date) AS ascension_date,
						COUNT(ta.id) AS total_tests,

						GROUP_CONCAT(
							DISTINCT CONCAT(
								COALESCE(tp.name, CONCAT('Test-', ta.testid)),
								' (',
								CASE
									WHEN ta.resultEntryEnd IS NOT NULL 
										THEN CONCAT('Completed @ ', DATE_FORMAT(ta.resultEntryEnd, '%h:%i %p'))

									WHEN ta.processingEndDate IS NOT NULL 
										THEN CONCAT('Processing Done @ ', DATE_FORMAT(ta.processingEndDate, '%h:%i %p'))

									WHEN ta.collectionEndDate IS NOT NULL 
										THEN CONCAT('Collected @ ', DATE_FORMAT(ta.collectionEndDate, '%h:%i %p'))

									WHEN ta.collectionStartDate IS NOT NULL 
										THEN CONCAT('Collection Started @ ', DATE_FORMAT(ta.collectionStartDate, '%h:%i %p'))

									ELSE 'Pending'
								END,
								')'
							)
							ORDER BY tp.name
							SEPARATOR ', '
						) AS tests_with_stage

						FROM billing b

						JOIN new_patients p 
						ON p.patientid = b.patientid

						JOIN test_ascension ta 
						ON ta.billingid = b.billingid

						LEFT JOIN test_panels tp 
						ON tp.id = ta.testid

						LEFT JOIN departments d
						ON d.id = tp.category

						LEFT JOIN dbobillingrefundtable rf
						ON rf.serviceid = ta.serviceid

						LEFT JOIN dboservices AS dbo ON dbo.serviceid = ta.serviceid

						${whereConditions}

						GROUP BY 
						p.patientid,
						p.fullpatientid,
						p.firstname,
						p.lastname,
						p.gender,
						p.age,
						p.agetype,
						b.billingid,
						b.billedon,
						b.clientstatus

						ORDER BY 
						b.billingid DESC;
		`;

               return await promisifyQuery(tenantid, query, params);
          } catch (err: any) {
               throw new Error(err?.message || "Error fetching ascension overview model");
          }
     }

     public static async getAscensionOverViewModelTransaction(tenantid: number, billingid: number): Promise<any> {
          try {
               const query = `
							SELECT 
							ta.id AS ascension_id,

							ta.testid,
							COALESCE(tp.name, CONCAT('Test-', ta.testid)) AS test_name,

							ta.serviceid,
							ta.billingid,

							ta.ascension_date,

							ta.collectionStartDate,
							ta.collectionEndDate,
							ta.processingStartDate,
							ta.processingEndDate,
							ta.resultEntryStart,
							ta.resultEntryEnd,

							rdp.requested_mode,
							rdl.delivered_mode,
							rdl.delivered_at,
							rrd.username AS delivered_by_name,
							rdl.notes as delivery_notes,

							rr.username AS collected_by_name,
							vv.username AS processed_by_name,
							ee.username AS result_entered_by_name,

							-- 🔬 SAMPLE STATUS
							ss.keyid AS sample_status_id,
							ss.approvalstatus,
							ss.rejectionmessage,
							ss.isRedraw,
							ss.samplevalidatedon,

							CASE
								WHEN ss.approvalstatus = 1 THEN 'Validated'
								WHEN ss.rejectionmessage IS NOT NULL THEN 'Rejected'
								WHEN ss.isRedraw = 1 THEN 'Redraw Requested'
								WHEN ss.keyid IS NOT NULL THEN 'Pending Validation'
								ELSE 'No Sample'
							END AS sample_validation_stage,

							-- 🧪 RESULT VALIDATION
							ra.id AS result_approval_id,
							ra.isapproved,
							ra.approvedBy,
							ra.printCount,
							ra.minvalidation,
							ra.maxvalidation,
							ra.lastupdatedon,

							CASE
								WHEN ra.isapproved = 1 THEN 'Approved'
								WHEN ra.id IS NOT NULL THEN 'Pending Approval'
								ELSE 'No Result Yet'
							END AS result_validation_stage,

							-- 🔬 TEST WORKFLOW
							CASE
								WHEN ta.resultEntryEnd IS NOT NULL THEN 'Completed'
								WHEN ta.processingEndDate IS NOT NULL THEN 'Processing Done'
								WHEN ta.collectionEndDate IS NOT NULL THEN 'Collected'
								WHEN ta.collectionStartDate IS NOT NULL THEN 'Collection Started'
								ELSE 'Pending'
							END AS current_stage

							FROM test_ascension ta

							LEFT JOIN dboservices AS trx ON trx.serviceid = ta.serviceid
							LEFT JOIN dbobillingrefundtable AS ddd ON ddd.serviceid = ta.serviceid
						
							LEFT JOIN test_panels tp 
							ON tp.id = ta.testid

							LEFT JOIN departments d
							ON d.id = tp.category

							LEFT JOIN roles rr 
							ON rr.employeeid = ta.sampleCollectedBy

							LEFT JOIN roles vv
							ON vv.employeeid = ta.sampleProcessedBy

							LEFT JOIN roles ee
							ON ee.employeeid = ta.resultEnteredBy

							LEFT JOIN samplestatus ss
							ON ss.ascensionid = ta.id

							LEFT JOIN dbotestresultapproval ra
							ON ra.ascensionid = ta.id


							LEFT JOIN result_delivery_log AS rdl
							ON ss.ascensionid = rdl.ascensionid

							LEFT JOIN patient_result_delivery_preference AS rdp
							ON ss.ascensionid = rdp.ascension
							
							LEFT JOIN roles AS rrd
							ON rrd.employeeid = rdl.delivered_by_employeeid

							WHERE ta.billingid = ?
							AND (d.department IS NOT NULL AND LOWER(d.department) <> 'ultrasound')
							AND (trx.isDeleted = 0 OR trx.isDeleted IS NULL) AND ddd.isRefundCompleted <> 1
							ORDER BY 
							ta.id ASC,
							ss.keyid ASC,
							ra.id ASC;`;

               const rows = await promisifyQuery(tenantid, query, [billingid]);
               return new LaboratoryWorkflowService(tenantid).forAscensions(rows);
          } catch (err: any) {
               console.log(err);
               throw new Error(err?.message || "Error fetching ascension overview model transaction details");
          }
     }

     private static async generateAscensionQuery(
          queryParams: ascensionStageRequestQueryTypes,
          bypassProcessing = false,
     ): Promise<{ conditions: (string | Date)[]; finalQuery: string }> {
          const {
               from,
               to,
               isUltrasound,
               stage,
               clinicianId,
               organizationId,
               patientname,
               testid,
               patientid,
               billingid,
               ascensionid,
          } = queryParams;
          try {
               let finalQuery: string;
               const conditions: (string | Date)[] = [];
               finalQuery = replaceQueryValuesNonPartition(finalQuery);
               if (!isUltrasound) {
                    finalQuery = q_get_all_test_ready_for_various_stages(finalQuery, stage, bypassProcessing);
               } else {
                    finalQuery = q_get_all_test_ready_for_various_stages_ultrasound(finalQuery, stage);
               }

               if (from && to && !ascensionid && !billingid) {
                    const queueDate =
                         stage === "VALIDATION"
                              ? "COALESCE(dta.lastupdatedon, ta.resultEntryEnd, ta.ascension_date)"
                              : "ta.ascension_date";
                    finalQuery = finalQuery + ` AND DATE(${queueDate}) BETWEEN ? AND ? `;
                    conditions.push(new Date(from));
                    conditions.push(new Date(to));
               }

               // Priority filters: patientid > billingid > ascensionid
               if (patientid) {
                    finalQuery += ` AND np.patientid = ?`;
                    conditions.push(patientid as any as string);
               }

               if (billingid) {
                    finalQuery += ` AND b.billingid = ?`;
                    conditions.push(billingid as any as string);
               }

               if (ascensionid) {
                    // we can have multiple ascensionid like 33,34,35,36,37,414,1387  or just a single number
                    const isMultipleAscensionIds =
                         typeof ascensionid === "string" && (ascensionid as string).includes(",");
                    if (isMultipleAscensionIds) {
                         finalQuery += ` AND ta.id IN (${ascensionid})`;
                    } else {
                         finalQuery += ` AND ta.id = ?`;
                         conditions.push(ascensionid as any as string);
                    }
               }

               if (testid && (testid != null || testid != undefined) && !isNaN(testid)) {
                    finalQuery += ` AND ta.testid = ?`;
                    conditions.push(testid as any as string);
               }

               if (patientname) {
                    finalQuery += `
				AND REGEXP_REPLACE(
					LOWER(CONCAT_WS(' ', np.firstname, np.middlename, np.lastname)),
					'[[:space:]]+',
					' '
					) LIKE ?
				`;

                    conditions.push(`%${patientname.toLowerCase().trim().replace(/\s+/g, " ")}%`);
               }

               if (clinicianId && !isNaN(clinicianId as any as number)) {
                    finalQuery += ` AND ds.clinicianId = ?`;
                    conditions.push(clinicianId as any as string);
               }

               if (organizationId) {
                    finalQuery += ` AND ds.organizationId = ?`;
                    conditions.push(organizationId as any as string);
               }
               return { conditions, finalQuery };
          } catch (err) {
               return null;
          }

          function replaceQueryValuesNonPartition(finalQuery: string) {
               finalQuery =
                    isUltrasound === true ? q_get_all_result_entry_ultrasound_base : q_get_all_result_entry_base;
               return finalQuery;
          }
     }

     public async getBillCompletedTest(tenantId: number, billingid: number) {
          if (billingid) {
               const test_outcome = await promisifyQuery(tenantId, q_entered_result_part, [billingid]);
               return test_outcome;
          }
     }

     async getAllEnterResult(tenantId: number, data: resultQuery): Promise<any[] | undefined> {
          try {
               const {
                    from,
                    to,
                    patientid,
                    billingid,
                    fullname,
                    sortingwise,
                    count,
                    page,
                    mobile_number,
                    ascensionid,
               } = data;
               let queryString = q_get_all_entered_result;
               const conditions: string[] = [];
               const values: any[] = [];

               conditions.push(`ss.approvalstatus = 1`);
               conditions.push("dta.isapproved = 1");

               if (patientid && !isNaN(patientid)) {
                    conditions.push(`np.patientid = ?`);
                    values.push(parseInt(patientid.toString()));
               }

               if (billingid) {
                    conditions.push(`b.billingid = ?`);
                    values.push(billingid);
               }

               if (ascensionid) {
                    conditions.push(`ta.id = ?`);
                    values.push(ascensionid);
               }

               if (mobile_number) {
                    conditions.push(`np.mobile_number LIKE ?`);
                    values.push(`%${mobile_number}%`);
               }

               if (fullname) {
                    conditions.push(`LOWER(CONCAT(np.firstname, ' ', np.middlename, ' ', np.lastname)) LIKE ?`);
                    values.push(`%${fullname.toLowerCase()}%`);
               }

               if (from && !to) {
                    conditions.push(`DATE(b.billedon) BETWEEN ? AND CURRENT_DATE`);
                    values.push(from);
               } else if (from && to) {
                    conditions.push(`DATE(b.billedon) BETWEEN ? AND ?`);
                    values.push(from, to);
               }

               if (conditions.length > 0) {
                    queryString += ` WHERE ${conditions.join(" AND ")}`;
               }

               queryString += ` GROUP BY ta.id, ta.testid, np.patientid, b.billingid`;
               queryString += ` ORDER BY ta.ascension_date ${sortingwise === "ASC" ? "ASC" : "DESC"}`;
               queryString += ` LIMIT ? OFFSET ?`;

               const result = await paginationQuery({ page, count }, queryString, values, tenantId);

               if (result.length > 0) {
                    const approvalList = await Promise.all(
                         result.map(async (item: any) => {
                              const { ascensionid } = item;
                              const ascensionApprovalEmployeeList = await new TestApprovalClass(
                                   ascensionid,
                              ).getAscensionAprovedListDetails(tenantId);
                              return { ...item, validators: ascensionApprovalEmployeeList };
                         }),
                    );
                    return approvalList;
               }

               return [];
          } catch (err) {
               console.log(err);
          }
     }

     getAllTestPreview = async function (tenantId: number, billingid: number): Promise<any[]> {
          try {
               if (billingid) {
                    const alltest = await promisifyQuery(tenantId, q_get_all_test_preview, [billingid]);
                    return alltest;
               }
          } catch (error) {
               throw error;
          }
     };

     private async isTestValidated(tenantId: number, ascensionId: number): Promise<boolean> {
          try {
               const query = `SELECT isapproved FROM dbotestresultapproval WHERE ascensionid = ?`;
               const result = await promisifyQuery(tenantId, query, [ascensionId]);
               console.log("isTestValidated result:", result);
               return result.length > 0 && result[0].isapproved === 1;
          } catch (error) {
               console.log("Error checking test validation:", error);
               return false;
          }
     }

     async getUltrasoundWaitingList(tenantId: number, data: { count: number; page: number }): Promise<any[]> {
          const { count = 10, page = 1 } = data;
          const result = await paginationQuery({ count, page }, q_ultrasound_waitingList, [], tenantId);
          return result;
     }

     public static async getAscensionBasedOnStage(
          tenantId: number,
          queryParams: {
               sortby: "DESC" | "ASC";
               _dateFrom: Date | string;
               _dateEnd: Date | string;
               stage: string;
               grouped?: "grouped" | "ungrouped";
               branchid?: number;
               ascensionid?: number;
               billingid?: number;
               patientid?: number;
               testid?: number;
               patientname?: string;
               page: number;
               count: number;
               isUltrasound: boolean;
               clinicianId: number;
               organizationId: number;
          },
     ) {
          try {
               const {
                    _dateEnd,
                    _dateFrom,
                    stage,
                    page,
                    count,
                    isUltrasound,
                    sortby,
                    clinicianId,
                    organizationId,
                    ascensionid,
                    billingid,
                    patientid,
               } = queryParams;
               const settings = !isUltrasound && ['PROCESSING', 'COMPLETED'].includes(stage)
                    ? await new ApplicationSettings().getAllAppSettings(tenantId) : null;
               const { finalQuery, conditions: conditionx } = await Operations.generateAscensionQuery({
                    sortby,
                    from: _dateFrom,
                    to: _dateEnd,
                    stage,
                    patientid,
                    billingid,
                    ascensionid,
                    testid: queryParams.testid,
                    patientname: queryParams.patientname,
                    isUltrasound,
                    clinicianId,
                    organizationId,
                    grouped: queryParams.grouped || null,
               }, Number(settings?.byPassProcessing) === 1);
               let query = finalQuery;
               let conditionValues = conditionx;

               if (query == null) return null;
               if (queryParams.branchid != null) {
                    query += ` AND b.branchid = ? `;
                    conditionValues.push(queryParams.branchid as any);
               }

               if (queryParams.grouped === "grouped") {
                    query += `ORDER BY b.billingid {sorting} LIMIT ? OFFSET ? `;
                    query = query.replace("{sorting}", sortby === "ASC" ? "ASC" : "DESC");
                    return await paginationQuery({ count, page }, query, conditionValues, tenantId);
               }

               query += ` GROUP BY ta.id ORDER BY ta.id {sorting} LIMIT ? OFFSET ? `;
               query = query.replace("{sorting}", sortby === "ASC" ? "ASC" : "DESC");

               return await paginationQuery({ count, page }, query, conditionValues, tenantId);
          } catch (err) {
               return [];
          }
     }

     async searchLaboratoryOperations(
          tenantId: number,
          searchParams: {
               patientId?: number;
               billingId?: number;
               accessionId?: string;
               page: number;
               count: number;
               start_date?: string;
               end_date?: string;
          },
     ): Promise<any> {
          try {
               const { patientId, billingId, accessionId, page, count } = searchParams;
               const offset = (page - 1) * count;
               const params: any[] = [];

               let query = `
				SELECT
					b.billingid,
					b.billedon,
					np.patientid,
					CONCAT(np.firstname, ' ', COALESCE(np.middlename, ''), ' ', np.lastname) AS patient_name,
					np.mobile_number AS phonenumber,
					np.email,
					ta.id AS ascension_id,
					ta.testid,
					tp.name AS testname,
					tp.category,
					d.department,
					ta.ascension_date AS created_on,
					ta.collectionStartDate,
					ta.collectionEndDate,
					ta.processingStartDate,
					ta.processingEndDate,
					ta.resultEntryStart,
					ta.resultEntryEnd,
					(SELECT COUNT(DISTINCT testid) FROM test_ascension WHERE billingid = b.billingid) AS total_tests
				FROM billing b
				INNER JOIN new_patients np ON b.patientid = np.patientid
				LEFT JOIN test_ascension ta ON b.billingid = ta.billingid
				LEFT JOIN test_panels tp ON ta.testid = tp.id
				LEFT JOIN departments d ON tp.category = d.id
				WHERE 1=1
			`;

               if (patientId) {
                    query += ` AND np.patientid = ?`;
                    params.push(patientId);
               }

               if (billingId) {
                    query += ` AND b.billingid = ?`;
                    params.push(billingId);
               }

               if (accessionId) {
                    query += ` AND ta.id = ?`;
                    params.push(accessionId);
               }

               if (searchParams.start_date && searchParams.end_date) {
                    query += ` AND DATE(b.billedon) BETWEEN ? AND ?`;
                    params.push(searchParams.start_date, searchParams.end_date);
               } else if (searchParams.start_date) {
                    query += ` AND DATE(b.billedon) >= ?`;
                    params.push(searchParams.start_date);
               } else if (searchParams.end_date) {
                    query += ` AND DATE(b.billedon) <= ?`;
                    params.push(searchParams.end_date);
               }

               query += ` ORDER BY b.billedon DESC, ta.ascension_date DESC LIMIT ? OFFSET ?`;
               params.push(count, offset);

               const result = await promisifyQuery(tenantId, query, params);
               const groupedResults: Record<number, any> = {};

               const { TestAscension } = await import("./ascension");

               for (const row of result) {
                    const billingKey = row.billingid;
                    if (!groupedResults[billingKey]) {
                         groupedResults[billingKey] = {
                              billingId: row.billingid,
                              billedOn: row.billedon,
                              patient: {
                                   patientId: row.patientid,
                                   name: row.patient_name,
                                   phone: row.phonenumber,
                                   email: row.email,
                              },
                              summary: {
                                   totalTests: row.total_tests,
                              },
                              services: [],
                         };
                    }

                    if (row.ascension_id) {
                         let stage = await TestAscension.determineStage(tenantId, row.ascension_id);
                         if (row.resultEntryStart || row.resultEntryEnd) {
                              const isValidated = await this.isTestValidated(tenantId, row.ascension_id);
                              if (isValidated) {
                                   stage = "validated";
                              } else {
                                   stage = "validation";
                              }
                         }

                         groupedResults[billingKey].services.push({
                              ascensionId: row.ascension_id,
                              testId: row.testid,
                              testName: row.testname,
                              category: row.category,
                              department: row.department,
                              ascensionDate: row.created_on,
                              collectionStartDate: row.collectionStartDate,
                              collectionEndDate: row.collectionEndDate,
                              processingStartDate: row.processingStartDate,
                              processingEndDate: row.processingEndDate,
                              resultEntryStartDate: row.resultEntryStart,
                              resultEntryEndDate: row.resultEntryEnd,
                              stage: stage || "Unknown",
                         });
                    }
               }

               return {
                    results: Object.values(groupedResults),
                    pagination: {
                         page,
                         count,
                         total: result.length > 0 ? result.length : 0,
                    },
               };
          } catch (err) {
               console.log("Error in searchLaboratoryOperations:", err);
               throw new Error(`Failed to retrieve laboratory operations data. Please try again later.`);
          }
     }

     public static async uploadUltrasoundImages(
          tenantId: number,
          data: { ascensionid: number; testid: number; patientid: number; filename: string },
          actor?: number | null,
     ): Promise<boolean> {
          try {
               const { ascensionid, testid, patientid, filename } = data;
               await ImagingResultAuditRepository.ensureTable(tenantId);
               const connection = await KnexConnection(tenantId);
               return await connection.transaction(async (trx: any) => {
                    const [insertedId] = await trx("ultrasound_images").insert({
                         ascensionid,
                         testid,
                         patientid,
                         filename,
                         created_at: trx.fn.now(),
                    });
                    await ImagingResultAuditRepository.record(trx, [
                         {
                              ascensionid,
                              testid,
                              patientid,
                              entityType: "IMAGE",
                              entityId: insertedId as any,
                              action: "CREATE",
                              fieldName: "image",
                              oldValue: null,
                              newValue: filename,
                              employeeid: actor ?? null,
                         },
                    ]);
                    return true;
               });
          } catch (err) {
               console.log("Error in uploadUltrasoundImages:", err);
               return false;
          }
     }

     public static async getUltrasoundImagesByAscension(tenantId: number, ascensionid: number): Promise<any[]> {
          try {
               if (!ascensionid || isNaN(ascensionid)) {
                    return [];
               }
               const query = `SELECT id, filename, created_at FROM ultrasound_images WHERE ascensionid = ? ORDER BY created_at DESC`;
               return await promisifyQuery(tenantId, query, [ascensionid]);
          } catch (err) {
               console.log("Error in getUltrasoundImagesByAscension:", err);
               return [];
          }
     }

     public static async getUltrasoundImageById(tenantId: number, id: number): Promise<any> {
          try {
               const query = `SELECT * FROM ultrasound_images WHERE id = ?`;
               const results = await promisifyQuery(tenantId, query, [id]);
               return results[0];
          } catch (err) {
               console.log("Error in getUltrasoundImageById:", err);
               return null;
          }
     }

     public static async deleteUltrasoundImage(tenantId: number, id: number, actor?: number | null): Promise<boolean> {
          try {
               await ImagingResultAuditRepository.ensureTable(tenantId);
               const connection = await KnexConnection(tenantId);
               return await connection.transaction(async (trx: any) => {
                    const image = await trx("ultrasound_images").where({ id }).forUpdate().first();
                    if (!image) return false;
                    const affected = await trx("ultrasound_images").where({ id }).del();
                    if (affected > 0) {
                         await ImagingResultAuditRepository.record(trx, [
                              {
                                   ascensionid: image.ascensionid,
                                   testid: image.testid,
                                   patientid: image.patientid,
                                   entityType: "IMAGE",
                                   entityId: id,
                                   action: "DELETE",
                                   fieldName: "image",
                                   oldValue: image.filename,
                                   newValue: null,
                                   employeeid: actor ?? null,
                              },
                         ]);
                    }
                    return affected > 0;
               });
          } catch (err) {
               console.log("Error in deleteUltrasoundImage:", err);
               return false;
          }
     }
}
