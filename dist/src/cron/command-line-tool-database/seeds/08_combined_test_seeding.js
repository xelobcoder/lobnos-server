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
    return knex('test_panels').del()
        .then(() => knex('testcreationrules').del())
        .then(function () {
        const currentDate = new Date();
        // Path to the creationrules directory
        const creationRulesPath = path.join(__dirname, '..', 'laboratory-test-panels', 'creationrules');
        // Read all JSON files from the directory
        const files = fs.readdirSync(creationRulesPath).filter(file => file.endsWith('.json'));
        console.log(`Found ${files.length} JSON files to process`);
        const seenNames = new Set();
        let processedCount = 0;
        // Process each file one by one
        const processFile = async (file) => {
            try {
                const filePath = path.join(creationRulesPath, file);
                const fileContent = fs.readFileSync(filePath, 'utf8');
                const jsonData = JSON.parse(fileContent);
                // Each file contains an array with one test panel object
                if (Array.isArray(jsonData) && jsonData.length > 0) {
                    const testPanel = jsonData[0];
                    const normalizedName = testPanel.name.toLowerCase().trim();
                    // Skip if we've already seen this name (ensure uniqueness - case insensitive)
                    if (seenNames.has(normalizedName)) {
                        console.log(`Skipping duplicate test name: ${testPanel.name} (${file})`);
                        return;
                    }
                    seenNames.add(normalizedName);
                    // 1. First, create the test panel
                    const panelData = {
                        name: testPanel.name,
                        category: testPanel.category,
                        price: testPanel.price || 0,
                        sample: testPanel.sample,
                        description: testPanel.description,
                        sample_container: testPanel.sample_container,
                        unit: testPanel.unit,
                        qty_required: testPanel.qty_required,
                        shorttext: testPanel.shorttext,
                        iscustom: testPanel.iscustom || 0,
                        filename: file, // Store filename for reference
                        created_on: currentDate
                    };
                    const [panelId] = await knex('test_panels').insert(panelData);
                    console.log(`Created test panel: ${testPanel.name} (ID: ${panelId})`);
                    // 2. Then, create the test creation rules for this panel
                    if (testPanel.testcreationrules && Array.isArray(testPanel.testcreationrules)) {
                        const rulesData = testPanel.testcreationrules.map((rule, index) => {
                            var _a, _b;
                            return ({
                                testid: panelId,
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
                            });
                        });
                        if (rulesData.length > 0) {
                            await knex('testcreationrules').insert(rulesData);
                            console.log(`Created ${rulesData.length} rules for: ${testPanel.name}`);
                        }
                    }
                    processedCount++;
                }
            }
            catch (error) {
                console.error(`Error processing file ${file}:`, error);
            }
        };
        // Process files sequentially
        return files.reduce((promise, file) => {
            return promise.then(() => processFile(file));
        }, Promise.resolve()).then(() => {
            console.log(`\nSeeding completed successfully!`);
            console.log(`Processed ${processedCount} unique test panels`);
            console.log(`Skipped ${files.length - processedCount} duplicate tests`);
        });
    });
};
/content>
    < parameter;
name = "filePath" > c;
Programming;
PLS - DIFFERENT - VERSIONS;
LobnosProfessionalVersion;
lobnos - server;
src;
cron;
command - line - tool - database;
Seeds;
8;
_combined_test_seeding.ts;
