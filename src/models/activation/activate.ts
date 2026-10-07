import { Request, Response } from "express";
import { promisifyQuery, rowAffected } from "../../hooks/helper";


type Activation = {
	patientid: number;
	action: string;
	isbulk: boolean;
};

export async function changeActivationStatus(tenantId: number, data: Activation) {
	let q_query = "UPDATE new_patients SET activation_status = ?";

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

	return rowAffected(await promisifyQuery(tenantId, q_query, [action, patientid]));
}

export async function changeActivationRouter(request: Request, response: Response) {
	const { tenantId } = request.query;
	if (!tenantId) {
		return response.send({ status: false, message: "tenantId is required" });
	}
	try {
		const requestQuery = request.query as unknown as Activation;
		const status = await changeActivationStatus(parseInt(tenantId.toString()), requestQuery);
		response.send({ status });
	} catch (err) {
		response.send({ status: false });
	}
}