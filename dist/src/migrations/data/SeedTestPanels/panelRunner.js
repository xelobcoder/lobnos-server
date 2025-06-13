"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PanelRunner = void 0;
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
const helper_1 = require("../../../hooks/helper");
const TestCreationRulesRepository_1 = __importDefault(require("../../../models/TestCreation/TestCreationRulesRepository"));
const test_creation_metadata_1 = require("../test_creation_metadata");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
async function PanelRunner(tenantId) {
    const connection = await (0, KnexConnections_1.default)(tenantId);
    await connection("testcreationrules").del();
    await connection("test_panels").del();
    for (const panel of test_creation_metadata_1.testspanels) {
        const { name, filename } = panel;
        const query = `INSERT INTO test_panels (name, iscustom) VALUES (?, ?)`;
        const result = await (0, helper_1.promisifyQuery)(tenantId, query, [name, 1]);
        const insertedId = result.insertId;
        const testidRow = await (0, helper_1.promisifyQuery)(tenantId, `SELECT * FROM test_panels WHERE prim_key = ? LIMIT 1`, [insertedId]);
        const testid = testidRow[0]['id'];
        try {
            const filenamepath = path_1.default.join(__dirname, `../migrationseeds/${filename}`);
            const fileContent = await promises_1.default.readFile(filenamepath, 'utf-8');
            const parseddata = JSON.parse(fileContent);
            const formattedData = parseddata.testcreationrule.map(rule => ({
                name: rule.name,
                value: rule.value,
                hasunits: rule.hasUnits,
                units: rule.units,
                plan: rule.plan,
                plain: rule.plain,
                ordering: rule.ordering,
                textReference: rule.textReference,
                upperlimit: rule.upperLimit,
                lowerlimit: rule.lowerLimit,
                undercategory: rule.underCategory,
                categoryid: rule.categoryId,
                options: rule.options
            }));
            await new TestCreationRulesRepository_1.default(tenantId).create(formattedData, testid);
        }
        catch (err) {
            console.log(err);
            await (0, helper_1.promisifyQuery)(tenantId, `DELETE FROM test_panels WHERE id =? LIMIT 1`, [testid]);
            await (0, helper_1.promisifyQuery)(tenantId, `DELETE FROM testcreationrules WHERE testid =? LIMIT 1`, [testid]);
        }
    }
}
exports.PanelRunner = PanelRunner;
