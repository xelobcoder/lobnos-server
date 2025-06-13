"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TableReconfiguration = void 0;
const helper_1 = require("../../hooks/helper");
const testpanelList_1 = require("../../testpanel/testpanelList");
class TableReconfiguration {
    constructor(add, tenantId) {
        this.add = add;
        this.tenantId = tenantId;
    }
    async deleteTestTriggers(testid) {
        const delete_trigger = `DROP TRIGGER IF EXISTS  \`trgDelResult${testid}\``;
        return await (0, helper_1.promisifyQuery)(this.tenantId, delete_trigger);
    }
    async deleteTestUpdateTrigger(testid) {
        const delete_trigger = `DROP TRIGGER IF EXISTS  \`trgUpdResult${testid}\``;
        return await (0, helper_1.promisifyQuery)(this.tenantId, delete_trigger);
    }
    async alteringColumnNames(columnName, newName) {
        const q_checking_column_present = `SELECT COUNT(*) as count
                                           FROM information_schema.COLUMNS
                                           WHERE TABLE_SCHEMA = 'limsdb'
                                           AND TABLE_NAME = '${newName}'
                                           AND COLUMN_NAME = '${columnName}'`;
        const packet = await (0, helper_1.promisifyQuery)(this.tenantId, q_checking_column_present);
        return packet[0]['count'] === 1;
    }
    async addEntryMode(columnName, newName) {
        const hasColumn = await this.alteringColumnNames(columnName, newName);
        if (!hasColumn) {
            const altering = `ALTER TABLE ${newName}
                              ADD COLUMN entrymode VARCHAR(20) DEFAULT 'manual';`;
            await (0, helper_1.promisifyQuery)(this.tenantId, altering);
            return true;
        }
        return false;
    }
    async reconfigureTables(oldName, newName, testid) {
        try {
            async function rename(oldName, newName) {
                const altername = `RENAME TABLE ${oldName} TO ${newName}`;
                await (0, helper_1.promisifyQuery)(this.tenantId, altername);
            }
            const old_pr = await this.isTableExistInDatabase(oldName);
            const new_pr = await this.isTableExistInDatabase(newName);
            console.table({ oldName, newName, old_pr, new_pr });
            if (!old_pr && !new_pr) {
                await testpanelList_1.testpanel.createTestProcess(this.tenantId, testid);
                return newName;
            }
            else if (old_pr && !new_pr) {
                await rename(oldName, newName);
                return newName;
            }
            else {
                return newName;
            }
        }
        catch (err) {
            throw err;
        }
    }
    async addingIndexToTable(item) {
        const test_table = testpanelList_1.testpanel.generateTableNameUsingTestid(item.testid);
        const _checking_index = `SELECT COUNT(*) as count
                                 FROM information_schema.STATISTICS
                                 WHERE table_schema = 'limsdb'
                                 AND table_name = ?
                                 AND index_name = 'idx_billingid_patientid'`;
        const hasIndex = await (0, helper_1.promisifyQuery)(this.tenantId, _checking_index, [test_table]);
        const count = hasIndex[0]['count'];
        if (count === 0) {
            const addingIndex = `ALTER TABLE ?? ADD INDEX idx_billingid_patientid (billingid, patientid)`;
            await (0, helper_1.promisifyQuery)(this.tenantId, addingIndex, [test_table]);
        }
    }
    async isTableExistInDatabase(tablename) {
        const tableExistenceQuery = `SELECT COUNT(*) AS ispresent
                    FROM information_schema.tables 
                    WHERE table_schema = 'limsdb' 
                    AND table_name = ?`;
        const info = await (0, helper_1.promisifyQuery)(this.tenantId, tableExistenceQuery, [tablename]);
        return info[0]["ispresent"] === 1;
    }
    async hasAuditTable(testid) {
        const generateAuditLogName = this.generateAuditLogNameUsingTestid(testid);
        return await this.isTableExistInDatabase(generateAuditLogName);
    }
    generateAuditLogNameUsingTestid(testid) {
        return `resultauditLog${testid}`.trim().toLowerCase();
    }
    async createAuditUpdateTrigger(testid) {
        const auditLogTableName = this.generateAuditLogNameUsingTestid(testid);
        const generatedTableName = testpanelList_1.testpanel.generateTableNameUsingTestid(testid);
        const createUpdateTriggerQuery = `
            CREATE TRIGGER \`trgUpdResult${testid}\`
            AFTER UPDATE ON \`${generatedTableName}\`
            FOR EACH ROW
            BEGIN
                INSERT INTO \`${auditLogTableName}\` (
                    previousValue,
                    billingid,
                    patientid,
                    field,
                    fieldid,
                    employeeid,
                    entrymode
                ) VALUES (
                    OLD.value,
                    OLD.billingid,
                    OLD.patientid,
                    OLD.field,
                    OLD.id,
                    OLD.employeeid,
                    OLD.entrymode
                );
            END`;
        await (0, helper_1.promisifyQuery)(this.tenantId, createUpdateTriggerQuery);
    }
    async createAuditDeleteTrigger(testid) {
        const auditLogTableName = this.generateAuditLogNameUsingTestid(testid);
        const generatedTableName = testpanelList_1.testpanel.generateTableNameUsingTestid(testid);
        const createDeleteTriggerQuery = `
            CREATE TRIGGER \`trgDelResult${testid}\`
            AFTER DELETE ON \`${generatedTableName}\`
            FOR EACH ROW
            BEGIN
                INSERT INTO \`${auditLogTableName}\` (
                    previousValue,
                    billingid,
                    patientid,
                    field,
                    fieldid,
                    employeeid,
                    entrymode
                ) VALUES (
                    OLD.value,
                    OLD.billingid,
                    OLD.patientid,
                    OLD.field,
                    OLD.id,
                    OLD.employeeid,
                    OLD.entrymode
                );
            END`;
        await (0, helper_1.promisifyQuery)(this.tenantId, createDeleteTriggerQuery);
    }
    async createAuditTable(testid) {
        const auditLogTableName = this.generateAuditLogNameUsingTestid(testid);
        const createAuditLogTableQuery = `
            CREATE TABLE \`${auditLogTableName}\` (
                id INT PRIMARY KEY AUTO_INCREMENT,
                field VARCHAR(100),
                billingid INT,
                patientid BIGINT,
                previousValue VARCHAR(60),
                employeeid INT,
                fieldid INT,
                entrymode VARCHAR(20) DEFAULT 'manual',
                created_on DATETIME(6) DEFAULT CURRENT_TIMESTAMP
            )`;
        await (0, helper_1.promisifyQuery)(this.tenantId, createAuditLogTableQuery);
        await this.createAuditUpdateTrigger(testid);
        await this.createAuditDeleteTrigger(testid);
        console.log('Audit table creation successful \n');
    }
    async reconfiguringTableTriggers(testid) {
        const deleteTrigger = `trgResultDel${testid}`;
        const updateTrigger = `trgResultDel${testid}`;
        const updateTriggerQuery = `SELECT COUNT(*) as count
                                    FROM information_schema.TRIGGERS
                                    WHERE TRIGGER_SCHEMA = 'limsdb'
                                    AND TRIGGER_NAME = '${updateTrigger}'`;
        const deleteTriggerQuery = `SELECT COUNT(*) as count
                                    FROM information_schema.TRIGGERS
                                    WHERE TRIGGER_SCHEMA = 'limsdb'
                                    AND TRIGGER_NAME = '${deleteTrigger}'`;
        const [has_update, has_delete] = await Promise.all([
            (0, helper_1.promisifyQuery)(this.tenantId, updateTriggerQuery),
            (0, helper_1.promisifyQuery)(this.tenantId, deleteTriggerQuery)
        ]);
        const hasAudit = await this.hasAuditTable(testid);
        if (!hasAudit) {
            await this.createAuditTable(testid);
        }
        if (has_delete[0]['count'] === 0) {
            await this.createAuditDeleteTrigger(testid);
        }
        if (has_update[0]['count'] === 0) {
            await this.createAuditUpdateTrigger(testid);
        }
    }
    async deleteTestResultTableTriggers(testid) {
        let isDelTest = await this.deleteTestTriggers(testid);
        let isDelUpdate = await this.deleteTestUpdateTrigger(testid);
        return isDelTest && isDelUpdate;
    }
    async createTestResultTriggers(testid) {
        await this.createAuditDeleteTrigger(testid);
        await this.createAuditUpdateTrigger(testid);
    }
    async deleteAllTestTablesAuditTriggers(testCollection) {
        try {
            const testnamescollection = await (0, helper_1.promisifyQuery)(this.tenantId, `SELECT name,id FROM test_panels`);
            testnamescollection.map(async (item, index) => {
                const tt = this.generateAuditLogNameUsingTestid(item.id);
                await this.deleteTestResultTableTriggers(item.id);
            });
        }
        catch (err) {
            console.log(err);
        }
    }
    async getOldTables() {
        const testnamescollection = await (0, helper_1.promisifyQuery)(this.tenantId, `SELECT name,id FROM test_panels`);
        console.log("################### Starting Reconfiguration #################");
        await Promise.all(testnamescollection.map(async (item) => {
            const newName = testpanelList_1.testpanel.generateTableNameUsingTestid(item.id);
            const oldName = testpanelList_1.testpanel.generatedTestTableName(item.name);
            await this.reconfigureTables(oldName, newName, item.id);
            // await this.alteringColumnNames('entrymode', newName);
            // console.log("....................initiating reconfiguring of tables..................");
            // await promisifyQuery(this.tenantId,`DROP TABLE IF EXISTS ${newName}`)
            // await promisifyQuery(this.tenantId,`DROP TABLE IF EXISTS ${oldName}`)
            // await promisifyQuery(this.tenantId,`DROP TABLE IF EXISTS ${testpanel.generateAuditLogNameUsingTestid(item.id)}`)
            console.log("-------reconfiguring table done ------------- ");
            // console.log("initiating testtable indexing");
            // await this.addingIndexToTable({ testid: item.id, name: item.name });
            // console.log("Indexing on database tables successfully done");
            // await this.reconfiguringTableTriggers(item.id);
            // console.log('Reconfiguring audit and triggers done');
        }));
        console.log("################### Reconfiguration Successfully Done #################");
    }
}
exports.TableReconfiguration = TableReconfiguration;
