"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
exports.seed = function (knex) {
    return knex('testcreationrules').del()
        .then(async function () {
        const currentDate = new Date();
        // First, get all test panels from the database
        const testPanels = await knex('test_panels').select('id', 'name', 'filename');
        console.log(`Found ${testPanels.length} test panels in database`);
        const allRules = [];
        // Path to the creationrules directory
        const creationRulesPath = path.join(__dirname, '..', 'laboratory-test-panels', 'creationrules');
        for (const panel of testPanels) {
            try {
                const filePath = path.join(creationRulesPath, panel.filename);
                if (!fs.existsSync(filePath)) {
                    console.log(`File not found: ${panel.filename} for test panel: ${panel.name}`);
                    continue;
                }
                const fileContent = fs.readFileSync(filePath, 'utf8');
                const jsonData = JSON.parse(fileContent);
                // Each file contains an array with one test panel object
                if (Array.isArray(jsonData) && jsonData.length > 0) {
                    const testPanel = jsonData[0];
                    // Extract testcreationrules
                    if (testPanel.testcreationrules && Array.isArray(testPanel.testcreationrules)) {
                        testPanel.testcreationrules.forEach((rule, index) => {
                            var _a, _b;
                            const ruleData = {
                                testid: panel.id,
                                name: rule.name,
                                hasunits: rule.hasunits || false,
                                units: rule.units || '',
                                plan: rule.plan || 'limits',
                                upperlimit: ((_a = rule.upperlimit) === null || _a === void 0 ? void 0 : _a.toString()) || '',
                                lowerlimit: ((_b = rule.lowerlimit) === null || _b === void 0 ? void 0 : _b.toString()) || '',
                                categoryid: rule.categoryid || null,
                                alert: rule.alert || null,
                                ordering: rule.ordering || index + 1,
                                undercategory: rule.undercategory || 0,
                                hasGenderVariation: false,
                                created_on: currentDate,
                                updated_on: currentDate
                            };
                            allRules.push(ruleData);
                        });
                        console.log(`Processed ${testPanel.testcreationrules.length} rules for: ${panel.name}`);
                    }
                }
            }
            catch (error) {
                console.error(`Error processing file ${panel.filename} for test panel ${panel.name}:`, error);
            }
        }
        console.log(`Total rules to insert: ${allRules.length}`);
        if (allRules.length > 0) {
            // Insert in batches to avoid memory issues
            const batchSize = 100;
            for (let i = 0; i < allRules.length; i += batchSize) {
                const batch = allRules.slice(i, i + batchSize);
                await knex('testcreationrules').insert(batch);
                console.log(`Inserted batch ${Math.floor(i / batchSize) + 1} (${batch.length} rules)`);
            }
        }
        console.log('Test creation rules seeding completed successfully!');
    });
};
