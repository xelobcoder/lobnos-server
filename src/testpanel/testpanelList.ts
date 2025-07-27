import { Request, Response } from "express";
import { allFieldsHasValues } from "./categories";
import { OperationsFailures } from "../models/operations/types";
import { q_ultrasound_list } from "./queries";
import { promisifyQuery, customError, rowAffected, convertKeysToLowerCase, responseError, hasSpecialCharacters } from "../hooks/helper";
import logger from "../hooks/logger";
import { TiifuWorkingClass } from "../database/TiifuWorkingClass";
import { PrimeLimsTabletestdetails } from "../database/DatabaseTableSchema";

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
		const isFieldsOkay = !Object.values(request.body).some((value) => !value);
		if (isFieldsOkay) {
			request.body.samplevolume = parseInt(request.body.samplevolume);
			const { test, price, category, unit, sample, samplevolume, samplecontainer, description } = request.body;
			const panelExist = await testpanel.panelExist(tenantId, test);
			if (panelExist) {
				return response.send({ statusCode: 200, status: "success", message: "Panel already exists" });
			} else {
				const query = `INSERT INTO test_panels (name, price, category, unit, qty_required, sample_container, description, sample) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
				const values = [test, price, category, unit, samplevolume, samplecontainer, description, sample];
				const outcome = rowAffected(await promisifyQuery(tenantId, query, values));
				return outcome
					? response.send({ statusCode: 201, status: "success", message: "Panel created successfully" })
					: response.send({ statusCode: 200, status: "error", message: "Panel creation failed" });
			}
		}
	},

	addSampleType: async (request: Request, response: Response) => {
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

	getSampleType: async (request: Request, response: Response) => {
		const { tenantId } = request.query;
		const tenantIdP = parseInt(tenantId.toString());
		const samples = await promisifyQuery(tenantIdP, "SELECT * FROM sampletype");
		response.send({ result: samples });
	},

	deleteSampleType: async (request: Request, response: Response) => {
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

	bulkTestUpdate: async (request: Request, response: Response) => {
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

	hasTest: async (tenantId: number, testname: string) => {
		if (!testname) throw new Error("Testname required");
		const result = await promisifyQuery(tenantId, `SELECT COUNT(*) AS count FROM test_panels WHERE name = ?`, [testname.trim()]);
		return result[0]["count"] == 0 ? false : true;
	},

	hasTrend: async (tenantId: number, testid: number) => {
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

				const updateMainPanel = await promisifyQuery(tenantId, query, [
					name,
					testprice,
					sample_container,
					sample,
					category,
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

	getpanelsbulk: async (tenantId: number, request: Request, response: Response) => {
		const query = `SELECT * FROM test_panels`;

		try {
			let result = await promisifyQuery(tenantId, query);
			if (result.length > 0) {
				result = result.map((item: any) => {
					return convertKeysToLowerCase({ ...item, sampleid: null });
				});
			}
			response.send({ message: "Success", statusCode: 200, status: "success", data: result });
		} catch (err) {
			logger.error(err);
			response.send({ message: (err as Error).message, statusCode: 500, status: "error" });
		}
	},

	getPanelBulKLessInformation: async function (request: Request, response: Response) {
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

	generatedTestTableName: function (testname: string) {
		return `result${this.generateTableName(testname)}`.trim();
	},

	generateAuditLogName: function (testname: string) {
		const tablename = this.generateTableName(testname);
		return `result${tablename}AuditLog`.trim();
	},

	testTableExist: async function (tenantId: number, testname: string) {
		const tablename = this.generatedTestTableName(testname);
		const tableExistenceQuery = `SELECT COUNT(*) AS ispresent
                    FROM information_schema.tables 
                    WHERE table_schema = 'limsdb' 
                    AND table_name = ?`;

		const info = await promisifyQuery(tenantId, tableExistenceQuery, [tablename]);
		return info[0]["ispresent"] === 1;
	},

	createTestProcess: async function (tenantId: number, testid: number) {
		try {
			const generatedTableName = this.generateTableNameUsingTestid(testid);
			const auditLogTableName = this.generateAuditLogNameUsingTestid(testid);
			const createTestTableQuery = `
        CREATE TABLE \`${generatedTableName}\` (
            id INT PRIMARY KEY AUTO_INCREMENT,
            field VARCHAR(100),
            billingid INT,
            patientid BIGINT,
            value VARCHAR(60),
		  originalvalue VARCHAR(60),
            created_on DATETIME(6) DEFAULT CURRENT_TIMESTAMP,
            updatedon DATETIME(6) DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            employeeid INT,
            entrymode VARCHAR(20) DEFAULT 'manual',
            INDEX idx_billingid_patientid (billingid, patientid)
        )`;

			const deleteTrigger = this.generateResultAuditLogDeleteTrigerName(testid);
			const updateTrigger = this.generateResultAuditLogUpdateTrigerName(testid);

			const createAuditLogTableQuery = `
        CREATE TABLE \`${auditLogTableName}\` (
            id INT PRIMARY KEY AUTO_INCREMENT,
            field VARCHAR(100),
            billingid INT,
            patientid BIGINT,
            previousValue VARCHAR(60),
		  previousoriginalvalue VARCHAR(60),
            employeeid INT,
            fieldid INT,
            entrymode VARCHAR(20) DEFAULT 'manual',
            created_on DATETIME(6) DEFAULT CURRENT_TIMESTAMP
        )`;

			const createUpdateTriggerQuery = `
        CREATE TRIGGER \`${updateTrigger}\`
        AFTER UPDATE ON \`${generatedTableName}\`
        FOR EACH ROW
        BEGIN
            INSERT INTO \`${auditLogTableName}\` (
                previousValue,
			 previousoriginalvalue,
                billingid,
                patientid,
                field,
                fieldid,
                employeeid,
                entrymode
            ) VALUES (
                OLD.value,
			 OLD.originalvalue,
                OLD.billingid,
                OLD.patientid,
                OLD.field,
                OLD.id,
                OLD.employeeid,
                OLD.entrymode
            );
        END`;

			const createDeleteTriggerQuery = `
        CREATE TRIGGER \`${deleteTrigger}\`
        AFTER DELETE ON \`${generatedTableName}\`
        FOR EACH ROW
        BEGIN
           INSERT INTO \`${auditLogTableName}\` (
                previousValue,
			 	 previousoriginalvalue,
                billingid,
                patientid,
                field,
                fieldid,
                employeeid,
                entrymode
            ) VALUES (
                OLD.value,
			 OLD.originalvalue,
                OLD.billingid,
                OLD.patientid,
                OLD.field,
                OLD.id,
                OLD.employeeid,
                OLD.entrymode
            );
        END`;

			await promisifyQuery(tenantId, createTestTableQuery);
			await promisifyQuery(tenantId, createAuditLogTableQuery);
			await promisifyQuery(tenantId, createUpdateTriggerQuery);
			await promisifyQuery(tenantId, createDeleteTriggerQuery);
			return true;
		} catch (err) {
			throw err;
		}
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
		let hasTestBeenCreated = false;
		try {
			if (!testname) {
				throw new Error("Testname required");
			}
			if (await this.hasTest(tenantId, testname)) {
				return "EXIST";
			}

			const query = `INSERT INTO test_panels (name, iscustom) VALUES (?, ?)`;
			const result = await promisifyQuery(tenantId, query, [testname, iscustom]);
			return rowAffected(result);
		} catch (err) {
			console.log(err)
			if (hasTestBeenCreated) {
				await promisifyQuery(tenantId, `DELETE FROM test_panels WHERE name = ?`, [testname]);
				throw new Error("Test creation failed");
			}
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
			// Get panel name first
			const panelQuery = `SELECT name FROM test_panels WHERE id = ?`;
			const panelResult = await promisifyQuery(tenantId, panelQuery, [testid]);
			if (panelResult.length === 0) return false;

			const panelName = panelResult[0].name;
			const generatedName = testpanel.generateTableName(tenantId, panelName);

			// Drop triggers first
			const deleteTrigger = testpanel.generateResultAuditLogDeleteTrigerName(testid);
			const updateTrigger = testpanel.generateResultAuditLogUpdateTrigerName(testid);

			await promisifyQuery(tenantId, `DROP TRIGGER IF EXISTS ${deleteTrigger}`);
			await promisifyQuery(tenantId, `DROP TRIGGER IF EXISTS ${updateTrigger}`);

			// Drop audit log table
			const auditTable = testpanel.generateAuditLogNameUsingTestid(testid);
			await promisifyQuery(tenantId, `DROP TABLE IF EXISTS ${auditTable}`);

			// Drop main results table
			const resultsTable = testpanel.generateTableNameUsingTestid(testid);
			await promisifyQuery(tenantId, `DROP TABLE IF EXISTS ${resultsTable}`);

			// Finally delete the panel entry
			// Delete dependent records first
			await promisifyQuery(tenantId,
				`DELETE FROM outsourcedtesttracking WHERE testid = ?`, [testid]);

			// Then delete the panel
			const deleteResult = await promisifyQuery(tenantId,
				`DELETE FROM test_panels WHERE id = ?`, [testid]);

			return rowAffected(deleteResult);
		} catch (error) {
			logger.error(`Error dropping panel ${testid}:`, error);
			return false;
		}
	},
};
