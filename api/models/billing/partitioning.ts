import { q_dropSpecificTablePartition, q_dropTableAllPartition } from "./queries";
import { promisifyQuery, rowAffected } from "./../../../helper.js";

export async function addPartitionTable() {}

export async function dropTablePartition(table_name: string) {
  return await promisifyQuery(q_dropTableAllPartition, [table_name]);
}

export async function dropTableSpecificPartition(table_name: string, partitionName: string) {
  return await promisifyQuery(q_dropSpecificTablePartition, [table_name, partitionName]);
}
