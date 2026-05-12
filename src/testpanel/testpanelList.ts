import { Request, Response } from "express";
import { allFieldsHasValues } from "./categories";
import { OperationsFailures } from "../models/operations/types";
import { q_ultrasound_list } from "./queries";
import { promisifyQuery, customError, rowAffected, responseError, hasSpecialCharacters } from "../hooks/helper";
import logger from "../hooks/logger";
import { PrimeLimsTabletestdetails } from "../database/DatabaseTableSchema";
import MasterTestPanelRepository from "../models/system-admin/MasterTestPanelRepository";
import KnexConnection from "../database/KnexConnections";
import { applyTestPanelsAfterInsert } from "../database/appLevelTriggers";
import { generateNextTestPanelId } from "./testPanelId";


interface TestPanel {
	id: number;
	name: string;
	price: number;
	sample: string;
	category: string;
	qty_required: number;
}

interface ProcedureManual {
	manual: string;
	testid: number;
	employeeid: number;
	title: string;
}

const resolveLookupId = async (
	tenantId: number,
	tableName: string,
	idColumn: string,
	nameColumn: string,
	value: unknown
): Promise<number | null> => {
	if (value === undefined || value === null || value === "") {
		return null;
	}

	if (typeof value === "number" && !Number.isNaN(value)) {
		return value;
	}

	const rawValue = String(value).trim();
	if (!rawValue) {
		return null;
	}

	const numericValue = Number(rawValue);
	if (!Number.isNaN(numericValue) && /^\d+$/.test(rawValue)) {
		return numericValue;
	}

	const connection = await KnexConnection(tenantId);
	const row = await connection(tableName)
		.select(idColumn)
		.whereRaw(`LOWER(${nameColumn}) = LOWER(?)`, [rawValue])
		.first();

	return row ? Number(row[idColumn]) : null;
};

export const testpanel = {
	listquery: `SELECT 
      tp.name,
      tp.id,
      tp.price,
      tp.created_on,
      tp.description,
      s.name AS sample,
      tp.sample_container,
      tp.unit,
      tp.qty_required,
      d.department AS category
    FROM test_panels AS tp
      INNER JOIN departments AS d ON d.id = tp.category
      INNER JOIN sampletype AS s ON s.id = tp.sample`,

	listqueryid: (tenantId: number, action: string, id: number) => {
		return `${action} FROM test_panels WHERE ID = ${id}`;
	},

	hasquery: (tenantId: number, request: Request) => {
		return Object.keys(request.query).length > 0;
	},

	updatequery: (tenantId: number, id: number, price: number, category: number) => {
		return `UPDATE test_panels SET price = ${price}, category = ${category} WHERE id = ${id}`;
	},

	postquery: (tenantId: number, name: string, price: number, category: string) => {
		return `INSERT INTO test_panels (NAME, CATEGORY, PRICE) VALUES ('${name}', '${category}', ${price})`;
	},

	panelExist: async (tenantId: number, name: string) => {
		const query = "SELECT name FROM test_panels WHERE name = ?";
		return (await promisifyQuery(tenantId, query, [name])).length > 0;
	},

	getPanels: async (tenantId: number, request: Request, response: Response) => {
		try {
			if (testpanel.hasquery(tenantId, request)) {
				const { id } = request.query as { id: string };
				const result = await promisifyQuery(tenantId, testpanel.listqueryid(tenantId, "SELECT *", parseInt(id)));
				response.send({ statusCode: 200, status: "success", message: "success", data: result });
			} else {
				const result = await promisifyQuery(tenantId, testpanel.listquery);
				response.send({ statusCode: 200, status: "success", message: "success", data: result });
			}
		} catch (err) {
			logger.error(err);
			response.status(500).send({ statusCode: 500, status: "error", message: (err as Error).message });
		}
	},

	updatePanel: async (tenantId: number, request: Request, response: Response) => {
		const { id, price, category } = request.query as { id: string; price: string; category: string };
		if (!id || !price || !category) return customError("Required request query missing", 404, response);
		const hasFieldValues = allFieldsHasValues(request.body);
		if (hasFieldValues) {
			const query = testpanel.updatequery(tenantId, parseInt(id), parseFloat(price), parseInt(category));
			const result = await promisifyQuery(tenantId, query);
			return rowAffected(result) ? response.send({ message: "Panel updated successfully" }) : response.send({ message: "Update failed" });
		}
		return response.send({ message: "All fields must have values" });
	},

	deletePanel: async (tenantId: number, testid: number) => {
		if (!testid || isNaN(testid)) throw new Error("testid not provided");
		const iscustomQuery = `SELECT iscustom, name FROM test_panels WHERE id = ?`;
		const result = await promisifyQuery(tenantId, iscustomQuery, [testid]);
		if (result.length === 0) return false;
		const isCustom = result[0]["iscustom"];
		if (isCustom === 0) return false;
		const isDeleted = rowAffected(await promisifyQuery(tenantId, `DELETE FROM test_panels WHERE id = ? AND iscustom = 1`, [testid]));
		if (isDeleted) {
			const testname = result[0]["name"].replace(/ /g, "_");
			const dropTableQ = `DROP TABLE result${testname}`;
			await promisifyQuery(tenantId, dropTableQ);
			return true;
		}
	},

	postPanel: async (tenantId: number, request: Request, response: Response) => {
		try {
			const isFieldsOkay = !Object.values(request.body).some((value) => !value);
			if (isFieldsOkay) {
				request.body.samplevolume = parseInt(request.body.samplevolume);
				const { test, price, category, unit, sample, samplevolume, samplecontainer, description } = request.body;
				const connection = await KnexConnection(tenantId);
				const trx = await connection.transaction();
				try {
					const existing = await trx("test_panels")
						.select("id")
						.whereRaw("LOWER(name) = LOWER(?)", [String(test).trim()])
						.first();
					if (existing) {
						await trx.rollback();
						return response.send({ statusCode: 200, status: "success", message: "Panel already exists" });
					}

					const id = await generateNextTestPanelId(trx);
					const inserted = await trx("test_panels").insert({
						id,
						name: test,
						price,
						category,
						unit,
						qty_required: samplevolume,
						sample_container: samplecontainer,
						description,
						sample,
						iscustom: 0,
					});
					const primKey = Array.isArray(inserted) ? inserted[0] : inserted;
					if (!primKey || Number(primKey) <= 0) {
						await trx.rollback();
						return response.send({ statusCode: 200, status: "error", message: "Panel creation failed" });
					}

					await applyTestPanelsAfterInsert(trx, { testid: Number(id), price: Number(price ?? 0), iscustom: 0 });
					await trx.commit();
					return response.send({ statusCode: 201, status: "success", message: "Panel created successfully" });
				} catch (err) {
					await trx.rollback();
					throw err;
				}
			}
			return response.send({ statusCode: 400, status: "error", message: "All fields must have values" });
		} catch (err) {
			logger.error(err);
			return response.status(500).send({ statusCode: 500, status: "error", message: (err as Error).message });
		}
	},

	addSampleType: async (request: Request<{}, {}, { name: string }, { tenantId: number }>, response: Response) => {
		const { tenantId } = request.query;
		const tenantIdP = parseInt(tenantId.toString());
		const query = "INSERT INTO sampletype (name) VALUE (?)";
		const { name } = request.body;
		const result = rowAffected(await promisifyQuery(tenantIdP, query, [name]));
		return result
			? response.send({
				message: "Added successfully",
				statusCode: 201,
				status: "success",
			})
			: response.send({
				message: "Error adding sample type",
				statusCode: 500,
				status: "error",
			});
	},

	getSampleType: async (request: Request<{}, {}, {}, { tenantId: number }>, response: Response) => {
		const { tenantId } = request.query;
		const tenantIdP = parseInt(tenantId.toString());
		const samples = await promisifyQuery(tenantIdP, "SELECT * FROM sampletype");
		response.send({ result: samples });
	},

	deleteSampleType: async (request: Request<{}, {}, {}, { tenantId: number, id: string }>, response: Response) => {
		try {
			const { id } = request.query as { id: string };
			if (!id || isNaN(parseInt(id))) return customError("Valid id not provided", 404, response);

			const { tenantId } = request.query;
			const tenantIdP = parseInt(tenantId.toString());


			const deleteQuery = "DELETE FROM sampletype WHERE id = ?";
			const result = await promisifyQuery(tenantIdP, deleteQuery, [parseInt(id)]);
			return rowAffected(result)
				? response.send({
					message: "Deleted successfully",
					statusCode: 200,
					status: "success",
				})
				: response.send({
					message: "Deletion failed",
					statusCode: 200,
					status: "error",
				});
		} catch (err) {
			response.send({
				message: (err as Error).message,
				statusCode: 500,
				status: "error",
			});
		}
	},

	bulkTestUpdate: async (request: Request<{}, {}, { panel: TestPanel[] }, { tenantId: number }>, response: Response) => {
		const { panel } = request.body;
		if (!panel) {
			response.send({ message: "Panel required", statusCode: "400", status: "error" });
		} else {
			const { tenantId } = request.query;
			const tenantIdP = parseInt(tenantId.toString());

			if (Array.isArray(panel) && panel.length > 0) {
				try {
					panel.forEach(async (item: TestPanel, index: number) => {
						const { id, name, price, sample, category, qty_required } = item;
						const queryString = `UPDATE test_panels SET 
             name = ?, price = ?, sample = ?, category = ?, qty_required = ? WHERE id = ?`;
						const result = await promisifyQuery(tenantIdP, queryString, [name, price, sample, category, qty_required, id]);
						if (result.affectedRows > 0) {
							if (index === panel.length - 1) {
								response.send({ message: "Update successful", statusCode: "201", status: "success" });
							}
						}
					});
				} catch (err) {
					logger.error(err);
					response.send({ message: (err as Error).message, statusCode: "500", status: "error" });
				}
			}
		}
	},

	hasTest: async (tenantId: number, testname: string): Promise<boolean> => {
		if (!testname) throw new Error("Testname required");
		const connection = await KnexConnection(tenantId);
		const result = await connection('test_panels')
			.where('name', testname.trim()).count('* as count').first();
		return result ? Number(result.count) > 0 : false;
	},

	hasTrend: async (tenantId: number, testid: number): Promise<boolean> => {
		if (!testid) throw new Error("Testid required");
		const result = await promisifyQuery(tenantId, `SELECT showtrend FROM testdetails WHERE testid = ?`, [testid]);
		return result[0]["showtrend"] == 0 ? false : true;
	},

	updateProcedureManual: async (tenantId: number, manual: string, testid: number, employeeid: number, title: string) => {
		if (!manual || typeof manual !== "string" || !testid || typeof testid !== "number" || !employeeid) {
			throw new Error("employeeid, manual and testid of string and number type respectively are required");
		}
		const query = `UPDATE proceduremanual SET 
       proceduremanual = ?,
       title = ?,
       updatedon = NOW(),
       createdby = ? WHERE testid = ?`;
		return rowAffected(await promisifyQuery(tenantId, query, [manual, title, employeeid, testid]));
	},

	getTestDetails: async (tenantId: number, testid: number): Promise<PrimeLimsTabletestdetails | null> => {
		const query = `SELECT * FROM test_panels INNER JOIN testdetails WHERE test_panels.id  = ?`;
		const result = await promisifyQuery(tenantId, query, [testid]);
		return Array.isArray(result) ? result[0] : null
	},

	getProcedureManuel: async (tenantId: number, testid: number) => {
		if (!testid) return false;
		const query = `SELECT * FROM proceduremanual WHERE testid = ?`;
		return await promisifyQuery(tenantId, query, [testid]);
	},

	getUltrasoundScanTestList: async (tenantId: number) => {
		return await promisifyQuery(tenantId, q_ultrasound_list);
	},

	isTestUltrasoundScanCategory: async (tenantId: number, testid: number) => {
		let result = await promisifyQuery(tenantId,
			`SELECT tp.category, tp.name, dp.department FROM test_panels AS tp INNER JOIN departments AS dp ON dp.id = tp.category WHERE dp.department = 'ultrasound' AND tp.id = ?`, [testid]
		);

		return result.length > 0;
	},

	putSingleTestPanel: async (tenantId: number, request: Request, response: Response) => {
		try {
			const { id } = request.body;

			if (!id) return customError(`Query id required`, 404, response);
			else {
				const query = `UPDATE test_panels SET
								name = ?,
								price = ?,
								sample_container = ?,
								sample = ?,
								category = ?,
								unit = ?,
								description = ?,
								qty_required = ?,
								shorttext = ?
								WHERE id = ?`;

				const {
					name,
					category,
					testprice,
					sample_container,
					unit,
					sample,
					shorttext,
					isoutsourced,
					description,
					qty_required,
					hasManual,
					procedureCode,
					tat,
					pre_Tat,
					post_Tat,
					showtrend,
					hasChildrenLimit,
					hasGenderVariation,
					tatCount,
					employeeid,
					testid,
					testcost,
					hasDrugs,
					post_TatEvaluation,
					pre_TatEvaluation,
					tatEvaluation,
					useLiterature,
					deviceInterfaceMapping,
					reportitle,
					method,
					instrumentation
				} = request.body;

				const resolvedSampleContainerId = await resolveLookupId(tenantId, "samplecontainer", "id", "name", sample_container);
				if (sample_container !== undefined && sample_container !== null && sample_container !== "" && resolvedSampleContainerId === null) {
					return customError("invalid sample_container provided", 400, response);
				}

				const resolvedSampleId = await resolveLookupId(tenantId, "sampletype", "id", "name", sample);
				if (sample !== undefined && sample !== null && sample !== "" && resolvedSampleId === null) {
					return customError("invalid sample provided", 400, response);
				}

				const resolvedCategoryId = await resolveLookupId(tenantId, "departments", "id", "department", category);
				if (category !== undefined && category !== null && category !== "" && resolvedCategoryId === null) {
					return customError("invalid category provided", 400, response);
				}

				const updateMainPanel = await promisifyQuery(tenantId, query, [
					name,
					testprice,
					resolvedSampleContainerId,
					resolvedSampleId,
					resolvedCategoryId,
					unit,
					description,
					qty_required,
					shorttext,
					testid,
				]);

				const outcome = rowAffected(updateMainPanel);
				if (outcome) {
					const updatePanel = `
								UPDATE testdetails SET 
									tat = ?,
									pre_Tat = ?,
									post_Tat = ?,
									hasManual = ?,
									procedureCode = ?,
									tatCount = ?,
									updatedby = ?,
									updatedon = NOW(),
									isoutsourced = ?,
									showtrend = ?,
									testprice = ?,
									hasChildrenLimit = ?,
									hasGenderVariation = ?,
									testcost = ?,
									useLiterature = ?,
									hasDrugs = ?,
									post_TatEvaluation =? ,
									pre_TatEvaluation = ?,
									tatEvaluation = ?,
									deviceInterfaceMapping = ?,
									reportitle = ?,
									method = ?,
									instrumentation = ?
								WHERE testid = ?`;

					const values = [
						tat,
						pre_Tat,
						post_Tat,
						hasManual,
						procedureCode,
						tatCount,
						employeeid,
						isoutsourced,
						showtrend,
						testprice,
						hasChildrenLimit,
						hasGenderVariation,
						testcost,
						useLiterature,
						hasDrugs,
						post_TatEvaluation,
						pre_TatEvaluation,
						tatEvaluation,
						deviceInterfaceMapping,
						reportitle,
						method,
						instrumentation,
						testid,
					];

					const updateTestDetails = await promisifyQuery(tenantId, updatePanel, values);

					response.send({ status: rowAffected(updateTestDetails) ? "success" : "failed" });
				}
			}
		} catch (err) {
			response.send(err);
		}
	},

	getpanelsbulk: async (tenantId: number, grouping: 'client' | 'master', filters: { filtercategory?: 'id' | 'name', searchstring?: string }) => {
		let query = `SELECT tp.*,td.testprice , td.testcost FROM test_panels AS tp
		LEFT JOIN testdetails AS td ON tp.id = td.testid`;

		const { filtercategory, searchstring } = filters;

		if (filtercategory && searchstring) {
			if (filtercategory === 'id') {
				query += ` WHERE tp.id = ${parseInt(searchstring)}`;
			} else if (filtercategory === 'name') {
				query += ` WHERE tp.name LIKE '%${searchstring}%'`;
			}
		}
		try {
			let result = grouping == "master" ? await new MasterTestPanelRepository().getMasterPanels() : await promisifyQuery(tenantId, query);
			return result;
		} catch (err) {
			logger.error(err);
			return false

		}
	},

	getPanelBulKLessInformation: async function (request: Request<{}, {}, {}, { tenantId: number }>, response: Response) {
		const tenantIdP = parseInt(request.query.tenantId.toString())
		try {
			const query = `SELECT tp.name,tp.price AS discountedValue,tp.id,td.isoutsourced,td.testid from test_panels AS tp INNER JOIN testdetails AS td ON td.testid = tp.id `;
			const result = await promisifyQuery(tenantIdP, query);
			if (result.length > 0) {
				const hasOutsourcedTestArray = result.filter((item: any, index: number) => item.isoutsourced == '1');
			}
			response.send({ data: result });
		} catch (err) {
			responseError(response);
		}
	},

	getPanelEditSingle: async (tenantId: number, testid: number, getPanelInformationWithoutDepartment = false) => {
		if (getPanelInformationWithoutDepartment) {
			return await testpanel.getPanelInformationWithoutDepartment(tenantId, testid);
		}
		const query = `SELECT * FROM test_panels AS tp 
			INNER JOIN testdetails AS td ON td.testid = tp.id
			INNER JOIN departments AS d ON d.id = tp.category
			WHERE tp.id = ?`;
		return await promisifyQuery(tenantId, query, [testid]);
	},

	getPanelInformationWithoutDepartment: async (tenantId: number, testid: number) => {
		const query = `SELECT * FROM test_panels AS tp INNER JOIN testdetails AS td ON td.testid = tp.id WHERE tp.id =?`;
		return await promisifyQuery(tenantId, query, [testid]);
	},

	generateTableName: (tenantId: number, testname: string) => {
		if (!testname) return false;
		if (typeof testname != "string") throw new TypeError("String required");
		const Ttestname = testname.split("");
		const len = testname.length;
		for (let i = 0; i < len; i++) {
			if (hasSpecialCharacters(testname[i], ["(", ")"])) {
				Ttestname[i] = "";
			}
			if (Ttestname[i] == " ") {
				Ttestname[i] = "_";
			}
		}
		return Ttestname.join("");
	},

	generateResultAuditLogDeleteTrigerName(testid: number) {
		return `trgDelResult${testid}`;
	},

	generateResultAuditLogUpdateTrigerName(testid: number) {
		return `trgUpdResult${testid}`;
	},

	generateTableNameUsingTestid(testid: number) {
		return `dboResult${testid}`;
	},

	generateAuditLogNameUsingTestid(testid: number) {
		return `dboResultauditLog${testid}`;
	},

	isTableExistInDatabase: async function (tenantId: number, tablename: string) {
		const tableExistenceQuery = `SELECT COUNT(*) AS ispresent
                    FROM information_schema.tables 
                    WHERE table_schema = 'limsdb' 
                    AND table_name = ?`;

		const info = await promisifyQuery(tenantId, tableExistenceQuery, [tablename]);
		return info[0]["ispresent"] === 1;
	},

	isNewTableUsingtestidExist: async function (tenantId: number, testid: number) {
		const tablename = this.generateTableNameUsingTestid(testid);
		return this.isTableExistInDatabase(tenantId, tablename);
	},

	generatedTestTableName: function (tenantid: number, testname: string) {
		return `result${this.generateTableName(tenantid, testname)}`.trim();
	},

	generateAuditLogName: function (tenantId: number, testname: string) {
		const tablename = this.generateTableName(tenantId, testname);
		return `result${tablename}AuditLog`.trim();
	},

	testTableExist: async function (tenantId: number, testname: string) {
		const tablename = this.generatedTestTableName(tenantId, testname);
		const tableExistenceQuery = `SELECT COUNT(*) AS ispresent
                    FROM information_schema.tables 
                    WHERE table_schema = 'limsdb' 
                    AND table_name = ?`;

		const info = await promisifyQuery(tenantId, tableExistenceQuery, [tablename]);
		return info[0]["ispresent"] === 1;
	},

	getTestUsingTestid: async function (tenantId: number, testid: number) {
		const query = `SELECT name FROM test_panels WHERE id = ?`;
		const packets = await promisifyQuery(tenantId, query, [testid]);
		if (packets.length == 0) return false;
		return packets[0]['name'];
	},

	getTestInfo: async function (tenantId: number, testid: number) {
		const query = `SELECT * FROM test_panels AS tp INNER JOIN testdetails AS td ON tp.id = td.testid WHERE tp.id = ?`;
		const packets = await promisifyQuery(tenantId, query, [testid]);
		if (packets.length == 0) return false;
		return packets[0];
	},

	getPanelCount: async function (tenantId: number) {
		const query = `SELECT COUNT(*) AS count FROM test_panels `;
		const packets = await promisifyQuery(tenantId, query);
		return packets[0]['count'];
	},


	createCustomTest: async function (tenantId: number, testname: string, iscustom: number = 1): Promise<boolean | string> {
		try {
			if (!testname) {
				throw new Error("Testname required");
			}
			if (await this.hasTest(tenantId, testname)) {
				return "EXIST";
			}

			const connection = await KnexConnection(tenantId);
			const trx = await connection.transaction();
			try {
				const id = await generateNextTestPanelId(trx);
				const inserted = await trx('test_panels').insert({ id, name: testname, iscustom });
				const primKey = Array.isArray(inserted) ? inserted[0] : inserted;
				const panel = await trx("test_panels")
					.select("id", "price", "iscustom").where({ prim_key: primKey }).first();
				if (panel?.id) {
					await applyTestPanelsAfterInsert(trx, {
						testid: Number(panel.id),
						price: Number(panel.price ?? 0),
						iscustom: Number(panel.iscustom ?? iscustom),
					});
				}
				await trx.commit();
				return !!(primKey && Number(primKey) > 0);
			} catch (err) {
				await trx.rollback();
				throw err;
			}
		} catch (err) {
			console.log(err);
			throw new Error("Test creation failed");
		}
	},

	changeTestName: async function (tenantId: number, testid: number, newTestName: string) {
		try {
			if (typeof newTestName != "string" || newTestName.length < 2) {
				return OperationsFailures.invalidTestLength
			};
			const savedOldTestName = await this.getTestUsingTestid(tenantId, testid);
			if (!savedOldTestName) return OperationsFailures.unfoundID;
			if (savedOldTestName === newTestName) return OperationsFailures.sameTestNameProvided

			const doTestWithSuchNameExist = await this.hasTest(tenantId, newTestName);
			if (doTestWithSuchNameExist) return OperationsFailures.TestExist;
			const q_alterTestName = `UPDATE test_panels SET name =? WHERE id = ? `;
			await promisifyQuery(tenantId, q_alterTestName, [newTestName, testid]);
			return true;
		} catch (error) {
			console.log(error);
			console.log(error);
		}
	},
	async dropPanelWithDependencies(tenantId: number, testid: number) {
		try {
			const connection = await KnexConnection(tenantId);
			const trx = await connection.transaction();

			try {
				const panel = await trx("test_panels").select("id").where({ id: testid }).first();
				if (!panel) {
					await trx.rollback();
					return false;
				}

				await trx("testcreationrules").where({ testid }).del();
				await trx("testdetailcategory").where({ testid }).del();
				await trx("setupliteraturereview").where({ testid }).del();
				await trx("proceduremanual").where({ testid }).del();
				// await trx("outsourcedtesttracking").where({ testid }).del();
				await trx("testdetails").where({ testid }).del();

				const deleteResult = await trx("test_panels").where({ id: testid }).del();
				await trx.commit();
				return deleteResult > 0;
			} catch (transactionError) {
				await trx.rollback();
				throw transactionError;
			}
		} catch (error) {
			logger.error(`Error dropping panel ${testid}:`, error);
			return false;
		}
	},
};
