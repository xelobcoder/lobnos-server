import { q_dropTablePartition } from "./queries";
import { promisifyQuery, rowAffected } from "./../../../helper.js";

export async function addPartitionTable() {}

export async function dropTablePartition(table_name: string) {
  return await promisifyQuery(q_dropTablePartition);
}
