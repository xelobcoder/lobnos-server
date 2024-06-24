import { q_dropSpecificTablePartition, q_dropTableAllPartition, q_reorganization_query } from "./queries";
import { promisifyQuery, rowAffected } from "./../../../helper.js";

export async function addPartitionTable() {}

export async function dropTablePartition(table_name: string) {
  return await promisifyQuery(q_dropTableAllPartition, [table_name]);
}

export async function dropTableSpecificPartition(table_name: string, partitionName: string) {
  return await promisifyQuery(q_dropSpecificTablePartition, [table_name, partitionName]);
}

export async function reOrganizePartitionBilling(max: number, min: number, year: number) {
  var query = q_reorganization_query;
  var tick = min + 1;
  let _month = `${max}`.padStart(2, "0");
  let _splitpartition = `billing_${year}_${_month}`;

  function partitionString(partionname: string, year: number, month: number, isComman: boolean) {
    var minquery = "";
    if (month < 12 && month > 0) {
      minquery += `PARTITION ${partionname} VALUES LESS THAN (${year},${tick + 1})`;
    } else if (month == 12 && month > 0) {
      minquery += `PARTITION ${partionname} VALUES LESS THAN (${year + 1},1)`;
    } else {
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
  const result = await promisifyQuery(query, [_splitpartition]);
  return result;
}
