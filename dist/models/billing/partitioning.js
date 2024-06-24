"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reOrganizePartitionBilling = exports.dropTableSpecificPartition = exports.dropTablePartition = exports.addPartitionTable = void 0;
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
async function reOrganizePartitionBilling(max, min, year) {
    var query = queries_1.q_reorganization_query;
    var tick = min + 1;
    let _month = `${max}`.padStart(2, "0");
    let _splitpartition = `billing_${year}_${_month}`;
    function partitionString(partionname, year, month, isComman) {
        var minquery = "";
        if (month < 12 && month > 0) {
            minquery += `PARTITION ${partionname} VALUES LESS THAN (${year},${tick + 1})`;
        }
        else if (month == 12 && month > 0) {
            minquery += `PARTITION ${partionname} VALUES LESS THAN (${year + 1},1)`;
        }
        else {
            throw new Error("wrong input provided");
        }
        return isComman ? (minquery += ",") : minquery;
    }
    while (tick <= max) {
        const _tick = `${tick}`.padStart(2, "0");
        const currentPartition = `billing_${year}_${_tick}`;
        tick != max
            ? (query += partitionString(currentPartition, year, tick, true))
            : (query += partitionString(currentPartition, year, tick, false));
        tick++;
    }
    query += ")";
    const result = await (0, helper_js_1.promisifyQuery)(query, [_splitpartition]);
    return result;
}
exports.reOrganizePartitionBilling = reOrganizePartitionBilling;
