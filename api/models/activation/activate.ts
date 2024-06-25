import { promisifyQuery, rowAffected } from "./../../../helper.js";

type Activation = {
  patientid: number;
  action: string;
  isbulk: boolean;
};

let q_query = "UPDATE new_patients SET activation_status = ?";

export async function changeActivationStatus(data: Activation) {
  const { patientid, action, isbulk = false } = data;
  if (!patientid || !action) {
    throw new Error("patientid and action event required");
  }

  if (["TRUE", "FALSE"].includes(action) === false) {
    throw new Error("FALSE || TRUE required");
  }

  if (!isbulk && typeof isbulk == "boolean") {
    q_query += " WHERE patientid = ?";
  }

  return rowAffected(await promisifyQuery(q_query, [action, patientid]));
}
