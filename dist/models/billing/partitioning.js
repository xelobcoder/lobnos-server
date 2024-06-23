"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dropTableSpecificPartition = exports.dropTablePartition = exports.addPartitionTable = void 0;
const queries_1 = require("./queries");
const helper_js_1 = require("./../../../helper.js");
async function addPartitionTable() { }
exports.addPartitionTable = addPartitionTable;
async function dropTablePartition(table_name) {
    return await (0, helper_js_1.promisifyQuery)(queries_1.q_dropTableAllPartition, [table_name]);
}
exports.dropTablePartition = dropTablePartition;
async function dropTableSpecificPartition(table_name, partitionName) {
    return await (0, helper_js_1.promisifyQuery)(queries_1.q_dropSpecificTablePartition, [table_name, partitionName]);
}
exports.dropTableSpecificPartition = dropTableSpecificPartition;
