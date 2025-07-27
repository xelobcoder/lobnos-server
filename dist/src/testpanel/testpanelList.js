"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testpanel = void 0;
const categories_1 = require("./categories");
const queries_1 = require("./queries");
const helper_1 = require("../hooks/helper");
const logger_1 = __importDefault(require("../hooks/logger"));
exports.testpanel = {
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
    listqueryid: (tenantId, action, id) => {
        return `${action} FROM test_panels WHERE ID = ${id}`;
    },
    hasquery: (tenantId, request) => {
        return Object.keys(request.query).length > 0;
    },
    updatequery: (tenantId, id, price, category) => {
        return `UPDATE test_panels SET price = ${price}, category = ${category} WHERE id = ${id}`;
    },
    postquery: (tenantId, name, price, category) => {
        return `INSERT INTO test_panels (NAME, CATEGORY, PRICE) VALUES ('${name}', '${category}', ${price})`;
    },
    panelExist: async (tenantId, name) => {
        const query = "SELECT name FROM test_panels WHERE name = ?";
        return (await (0, helper_1.promisifyQuery)(tenantId, query, [name])).length > 0;
    },
    getPanels: async (tenantId, request, response) => {
        try {
            if (exports.testpanel.hasquery(tenantId, request)) {
                const { id } = request.query;
                const result = await (0, helper_1.promisifyQuery)(tenantId, exports.testpanel.listqueryid(tenantId, "SELECT *", parseInt(id)));
                response.send({ statusCode: 200, status: "success", message: "success", data: result });
            }
            else {
                const result = await (0, helper_1.promisifyQuery)(tenantId, exports.testpanel.listquery);
                response.send({ statusCode: 200, status: "success", message: "success", data: result });
            }
        }
        catch (err) {
            logger_1.default.error(err);
            response.status(500).send({ statusCode: 500, status: "error", message: err.message });
        }
    },
    updatePanel: async (tenantId, request, response) => {
        const { id, price, category } = request.query;
        if (!id || !price || !category)
            return (0, helper_1.customError)("Required request query missing", 404, response);
        const hasFieldValues = (0, categories_1.allFieldsHasValues)(request.body);
        if (hasFieldValues) {
            const query = exports.testpanel.updatequery(tenantId, parseInt(id), parseFloat(price), parseInt(category));
            const result = await (0, helper_1.promisifyQuery)(tenantId, query);
            return (0, helper_1.rowAffected)(result) ? response.send({ message: "Panel updated successfully" }) : response.send({ message: "Update failed" });
        }
        return response.send({ message: "All fields must have values" });
    },
    deletePanel: async (tenantId, testid) => {
        if (!testid || isNaN(testid))
            throw new Error("testid not provided");
        const iscustomQuery = `SELECT iscustom, name FROM test_panels WHERE id = ?`;
        const result = await (0, helper_1.promisifyQuery)(tenantId, iscustomQuery, [testid]);
        if (result.length === 0)
            return false;
        const isCustom = result[0]["iscustom"];
        if (isCustom === 0)
            return false;
        const isDeleted = (0, helper_1.rowAffected)(await (0, helper_1.promisifyQuery)(tenantId, `DELETE FROM test_panels WHERE id = ? AND iscustom = 1`, [testid]));
        if (isDeleted) {
            const testname = result[0]["name"].replace(/ /g, "_");
            const dropTableQ = `DROP TABLE result${testname}`;
            await (0, helper_1.promisifyQuery)(tenantId, dropTableQ);
            return true;
        }
    },
    postPanel: async (tenantId, request, response) => {
        const isFieldsOkay = !Object.values(request.body).some((value) => !value);
        if (isFieldsOkay) {
            request.body.samplevolume = parseInt(request.body.samplevolume);
            const { test, price, category, unit, sample, samplevolume, samplecontainer, description } = request.body;
            const panelExist = await exports.testpanel.panelExist(tenantId, test);
            if (panelExist) {
                return response.send({ statusCode: 200, status: "success", message: "Panel already exists" });
            }
            else {
                const query = `INSERT INTO test_panels (name, price, category, unit, qty_required, sample_container, description, sample) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
                const values = [test, price, category, unit, samplevolume, samplecontainer, description, sample];
                const outcome = (0, helper_1.rowAffected)(await (0, helper_1.promisifyQuery)(tenantId, query, values));
                return outcome
                    ? response.send({ statusCode: 201, status: "success", message: "Panel created successfully" })
                    : response.send({ statusCode: 200, status: "error", message: "Panel creation failed" });
            }
        }
    },
    addSampleType: async (request, response) => {
        const { tenantId } = request.query;
        const tenantIdP = parseInt(tenantId.toString());
        const query = "INSERT INTO sampletype (name) VALUE (?)";
        const { name } = request.body;
        const result = (0, helper_1.rowAffected)(await (0, helper_1.promisifyQuery)(tenantIdP, query, [name]));
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
    getSampleType: async (request, response) => {
        const { tenantId } = request.query;
        const tenantIdP = parseInt(tenantId.toString());
        const samples = await (0, helper_1.promisifyQuery)(tenantIdP, "SELECT * FROM sampletype");
        response.send({ result: samples });
    },
    deleteSampleType: async (request, response) => {
        try {
            const { id } = request.query;
            if (!id || isNaN(parseInt(id)))
                return (0, helper_1.customError)("Valid id not provided", 404, response);
            const { tenantId } = request.query;
            const tenantIdP = parseInt(tenantId.toString());
            const deleteQuery = "DELETE FROM sampletype WHERE id = ?";
            const result = await (0, helper_1.promisifyQuery)(tenantIdP, deleteQuery, [parseInt(id)]);
            return (0, helper_1.rowAffected)(result)
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
        }
        catch (err) {
            response.send({
                message: err.message,
                statusCode: 500,
                status: "error",
            });
        }
    },
    bulkTestUpdate: async (request, response) => {
        const { panel } = request.body;
        if (!panel) {
            response.send({ message: "Panel required", statusCode: "400", status: "error" });
        }
        else {
            const { tenantId } = request.query;
            const tenantIdP = parseInt(tenantId.toString());
            if (Array.isArray(panel) && panel.length > 0) {
                try {
                    panel.forEach(async (item, index) => {
                        const { id, name, price, sample, category, qty_required } = item;
                        const queryString = `UPDATE test_panels SET 
             name = ?, price = ?, sample = ?, category = ?, qty_required = ? WHERE id = ?`;
                        const result = await (0, helper_1.promisifyQuery)(tenantIdP, queryString, [name, price, sample, category, qty_required, id]);
                        if (result.affectedRows > 0) {
                            if (index === panel.length - 1) {
                                response.send({ message: "Update successful", statusCode: "201", status: "success" });
                            }
                        }
                    });
                }
                catch (err) {
                    logger_1.default.error(err);
                    response.send({ message: err.message, statusCode: "500", status: "error" });
                }
            }
        }
    },
    hasTest: async (tenantId, testname) => {
        if (!testname)
            throw new Error("Testname required");
        const result = await (0, helper_1.promisifyQuery)(tenantId, `SELECT COUNT(*) AS count FROM test_panels WHERE name = ?`, [testname.trim()]);
        return result[0]["count"] == 0 ? false : true;
    },
    hasTrend: async (tenantId, testid) => {
        if (!testid)
            throw new Error("Testid required");
        const result = await (0, helper_1.promisifyQuery)(tenantId, `SELECT showtrend FROM testdetails WHERE testid = ?`, [testid]);
        return result[0]["showtrend"] == 0 ? false : true;
    },
    updateProcedureManual: async (tenantId, manual, testid, employeeid, title) => {
        if (!manual || typeof manual !== "string" || !testid || typeof testid !== "number" || !employeeid) {
            throw new Error("employeeid, manual and testid of string and number type respectively are required");
        }
        const query = `UPDATE proceduremanual SET 
       proceduremanual = ?,
       title = ?,
       updatedon = NOW(),
       createdby = ? WHERE testid = ?`;
        return (0, helper_1.rowAffected)(await (0, helper_1.promisifyQuery)(tenantId, query, [manual, title, employeeid, testid]));
    },
    getTestDetails: async (tenantId, testid) => {
        const query = `SELECT * FROM test_panels INNER JOIN testdetails WHERE test_panels.id  = ?`;
        const result = await (0, helper_1.promisifyQuery)(tenantId, query, [testid]);
        return Array.isArray(result) ? result[0] : null;
    },
    getProcedureManuel: async (tenantId, testid) => {
        if (!testid)
            return false;
        const query = `SELECT * FROM proceduremanual WHERE testid = ?`;
        return await (0, helper_1.promisifyQuery)(tenantId, query, [testid]);
    },
    getUltrasoundScanTestList: async (tenantId) => {
        return await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_ultrasound_list);
    },
    isTestUltrasoundScanCategory: async (tenantId, testid) => {
        let result = await (0, helper_1.promisifyQuery)(tenantId, `SELECT tp.category, tp.name, dp.department FROM test_panels AS tp INNER JOIN departments AS dp ON dp.id = tp.category WHERE dp.department = 'ultrasound' AND tp.id = ?`, [testid]);
        return result.length > 0;
    },
    putSingleTestPanel: async (tenantId, request, response) => {
        try {
            const { id } = request.body;
            if (!id)
                return (0, helper_1.customError)(`Query id required`, 404, response);
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
                const { name, category, testprice, sample_container, unit, sample, shorttext, isoutsourced, description, qty_required, hasManual, procedureCode, tat, pre_Tat, post_Tat, showtrend, hasChildrenLimit, hasGenderVariation, tatCount, employeeid, testid, testcost, hasDrugs, post_TatEvaluation, pre_TatEvaluation, tatEvaluation, useLiterature, deviceInterfaceMapping, reportitle, method, instrumentation } = request.body;
                const updateMainPanel = await (0, helper_1.promisifyQuery)(tenantId, query, [
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
                const outcome = (0, helper_1.rowAffected)(updateMainPanel);
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
                    const updateTestDetails = await (0, helper_1.promisifyQuery)(tenantId, updatePanel, values);
                    response.send({ status: (0, helper_1.rowAffected)(updateTestDetails) ? "success" : "failed" });
                }
            }
        }
        catch (err) {
            response.send(err);
        }
    },
    getpanelsbulk: async (tenantId, request, response) => {
        const query = `SELECT * FROM test_panels`;
        try {
            let result = await (0, helper_1.promisifyQuery)(tenantId, query);
            if (result.length > 0) {
                result = result.map((item) => {
                    return (0, helper_1.convertKeysToLowerCase)(Object.assign(Object.assign({}, item), { sampleid: null }));
                });
            }
            response.send({ message: "Success", statusCode: 200, status: "success", data: result });
        }
        catch (err) {
            logger_1.default.error(err);
            response.send({ message: err.message, statusCode: 500, status: "error" });
        }
    },
    getPanelBulKLessInformation: async function (request, response) {
        const tenantIdP = parseInt(request.query.tenantId.toString());
        try {
            const query = `SELECT tp.name,tp.price AS discountedValue,tp.id,td.isoutsourced,td.testid from test_panels AS tp INNER JOIN testdetails AS td ON td.testid = tp.id `;
            const result = await (0, helper_1.promisifyQuery)(tenantIdP, query);
            if (result.length > 0) {
                const hasOutsourcedTestArray = result.filter((item, index) => item.isoutsourced == '1');
            }
            response.send({ data: result });
        }
        catch (err) {
            (0, helper_1.responseError)(response);
        }
    },
    getPanelEditSingle: async (tenantId, testid, getPanelInformationWithoutDepartment = false) => {
        if (getPanelInformationWithoutDepartment) {
            return await exports.testpanel.getPanelInformationWithoutDepartment(tenantId, testid);
        }
        const query = `SELECT * FROM test_panels AS tp 
			INNER JOIN testdetails AS td ON td.testid = tp.id
			INNER JOIN departments AS d ON d.id = tp.category
			WHERE tp.id = ?`;
        return await (0, helper_1.promisifyQuery)(tenantId, query, [testid]);
    },
    getPanelInformationWithoutDepartment: async (tenantId, testid) => {
        const query = `SELECT * FROM test_panels AS tp INNER JOIN testdetails AS td ON td.testid = tp.id WHERE tp.id =?`;
        return await (0, helper_1.promisifyQuery)(tenantId, query, [testid]);
    },
    generateTableName: (tenantId, testname) => {
        if (!testname)
            return false;
        if (typeof testname != "string")
            throw new TypeError("String required");
        const Ttestname = testname.split("");
        const len = testname.length;
        for (let i = 0; i < len; i++) {
            if ((0, helper_1.hasSpecialCharacters)(testname[i], ["(", ")"])) {
                Ttestname[i] = "";
            }
            if (Ttestname[i] == " ") {
                Ttestname[i] = "_";
            }
        }
        return Ttestname.join("");
    },
    generateResultAuditLogDeleteTrigerName(testid) {
        return `trgDelResult${testid}`;
    },
    generateResultAuditLogUpdateTrigerName(testid) {
        return `trgUpdResult${testid}`;
    },
    generateTableNameUsingTestid(testid) {
        return `dboResult${testid}`;
    },
    generateAuditLogNameUsingTestid(testid) {
        return `dboResultauditLog${testid}`;
    },
    isTableExistInDatabase: async function (tenantId, tablename) {
        const tableExistenceQuery = `SELECT COUNT(*) AS ispresent
                    FROM information_schema.tables 
                    WHERE table_schema = 'limsdb' 
                    AND table_name = ?`;
        const info = await (0, helper_1.promisifyQuery)(tenantId, tableExistenceQuery, [tablename]);
        return info[0]["ispresent"] === 1;
    },
    isNewTableUsingtestidExist: async function (tenantId, testid) {
        const tablename = this.generateTableNameUsingTestid(testid);
        return this.isTableExistInDatabase(tenantId, tablename);
    },
    generatedTestTableName: function (testname) {
        return `result${this.generateTableName(testname)}`.trim();
    },
    generateAuditLogName: function (testname) {
        const tablename = this.generateTableName(testname);
        return `result${tablename}AuditLog`.trim();
    },
    testTableExist: async function (tenantId, testname) {
        const tablename = this.generatedTestTableName(testname);
        const tableExistenceQuery = `SELECT COUNT(*) AS ispresent
                    FROM information_schema.tables 
                    WHERE table_schema = 'limsdb' 
                    AND table_name = ?`;
        const info = await (0, helper_1.promisifyQuery)(tenantId, tableExistenceQuery, [tablename]);
        return info[0]["ispresent"] === 1;
    },
    createTestProcess: async function (tenantId, testid) {
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
            await (0, helper_1.promisifyQuery)(tenantId, createTestTableQuery);
            await (0, helper_1.promisifyQuery)(tenantId, createAuditLogTableQuery);
            await (0, helper_1.promisifyQuery)(tenantId, createUpdateTriggerQuery);
            await (0, helper_1.promisifyQuery)(tenantId, createDeleteTriggerQuery);
            return true;
        }
        catch (err) {
            throw err;
        }
    },
    getTestUsingTestid: async function (tenantId, testid) {
        const query = `SELECT name FROM test_panels WHERE id = ?`;
        const packets = await (0, helper_1.promisifyQuery)(tenantId, query, [testid]);
        if (packets.length == 0)
            return false;
        return packets[0]['name'];
    },
    getTestInfo: async function (tenantId, testid) {
        const query = `SELECT * FROM test_panels AS tp INNER JOIN testdetails AS td ON tp.id = td.testid WHERE tp.id = ?`;
        const packets = await (0, helper_1.promisifyQuery)(tenantId, query, [testid]);
        if (packets.length == 0)
            return false;
        return packets[0];
    },
    getPanelCount: async function (tenantId) {
        const query = `SELECT COUNT(*) AS count FROM test_panels `;
        const packets = await (0, helper_1.promisifyQuery)(tenantId, query);
        return packets[0]['count'];
    },
    createCustomTest: async function (tenantId, testname, iscustom = 1) {
        let hasTestBeenCreated = false;
        try {
            if (!testname) {
                throw new Error("Testname required");
            }
            if (await this.hasTest(tenantId, testname)) {
                return "EXIST";
            }
            const query = `INSERT INTO test_panels (name, iscustom) VALUES (?, ?)`;
            const result = await (0, helper_1.promisifyQuery)(tenantId, query, [testname, iscustom]);
            return (0, helper_1.rowAffected)(result);
        }
        catch (err) {
            console.log(err);
            if (hasTestBeenCreated) {
                await (0, helper_1.promisifyQuery)(tenantId, `DELETE FROM test_panels WHERE name = ?`, [testname]);
                throw new Error("Test creation failed");
            }
        }
    },
    changeTestName: async function (tenantId, testid, newTestName) {
        try {
            if (typeof newTestName != "string" || newTestName.length < 2) {
                return "invalid test length provided" /* OperationsFailures.invalidTestLength */;
            }
            ;
            const savedOldTestName = await this.getTestUsingTestid(tenantId, testid);
            if (!savedOldTestName)
                return "such id not found" /* OperationsFailures.unfoundID */;
            if (savedOldTestName === newTestName)
                return "Same Test Name provided for update" /* OperationsFailures.sameTestNameProvided */;
            const doTestWithSuchNameExist = await this.hasTest(tenantId, newTestName);
            if (doTestWithSuchNameExist)
                return "Test With Such Name Already Exist" /* OperationsFailures.TestExist */;
            const q_alterTestName = `UPDATE test_panels SET name =? WHERE id = ? `;
            await (0, helper_1.promisifyQuery)(tenantId, q_alterTestName, [newTestName, testid]);
            return true;
        }
        catch (error) {
            console.log(error);
            console.log(error);
        }
    },
    async dropPanelWithDependencies(tenantId, testid) {
        try {
            // Get panel name first
            const panelQuery = `SELECT name FROM test_panels WHERE id = ?`;
            const panelResult = await (0, helper_1.promisifyQuery)(tenantId, panelQuery, [testid]);
            if (panelResult.length === 0)
                return false;
            const panelName = panelResult[0].name;
            const generatedName = exports.testpanel.generateTableName(tenantId, panelName);
            // Drop triggers first
            const deleteTrigger = exports.testpanel.generateResultAuditLogDeleteTrigerName(testid);
            const updateTrigger = exports.testpanel.generateResultAuditLogUpdateTrigerName(testid);
            await (0, helper_1.promisifyQuery)(tenantId, `DROP TRIGGER IF EXISTS ${deleteTrigger}`);
            await (0, helper_1.promisifyQuery)(tenantId, `DROP TRIGGER IF EXISTS ${updateTrigger}`);
            // Drop audit log table
            const auditTable = exports.testpanel.generateAuditLogNameUsingTestid(testid);
            await (0, helper_1.promisifyQuery)(tenantId, `DROP TABLE IF EXISTS ${auditTable}`);
            // Drop main results table
            const resultsTable = exports.testpanel.generateTableNameUsingTestid(testid);
            await (0, helper_1.promisifyQuery)(tenantId, `DROP TABLE IF EXISTS ${resultsTable}`);
            // Finally delete the panel entry
            // Delete dependent records first
            await (0, helper_1.promisifyQuery)(tenantId, `DELETE FROM outsourcedtesttracking WHERE testid = ?`, [testid]);
            // Then delete the panel
            const deleteResult = await (0, helper_1.promisifyQuery)(tenantId, `DELETE FROM test_panels WHERE id = ?`, [testid]);
            return (0, helper_1.rowAffected)(deleteResult);
        }
        catch (error) {
            logger_1.default.error(`Error dropping panel ${testid}:`, error);
            return false;
        }
    },
};
