import { Request, Response } from "express";
import Registration from "../../models/registration/registration";
import { PatientRecords } from "../../models/registration/types";
import VitalSign from "../../models/customers/vitalsign";
import { vitalScan } from "../../models/customers/types";


export async function getCustomers(request: Request<{}, {}, {}, PatientRecords>, response: Response) {
	try {
		const tenantId: number = parseInt(request.query.tenantId, 10);
		const data = await new Registration().getCustomersRecords(tenantId, request.query);
		response.send(data);
	} catch (err) {
		response.send([]);
	}
}



export async function createNewVitalSign(request: Request<{},{}, vitalScan, { tenantId: number }>, response: Response) {
	try {
		const { patientid } = request.body;
		const tenantId: number = parseInt(request.query.tenantId.toString());
		const isCreated = await new VitalSign(patientid).createNewVitalSignChart(tenantId, request.body);
		response.send({ status: isCreated });
	} catch (err) {
		response.send([])
	}
}

export async function getPatientVitalSign(request: Request<{}, {}, {}, { tenantId: number, patientid: number|string, count: string, page: string, filterFrom?: string, filterTo?: string }>, response: Response) {
	try {
		const { patientid, count, page, filterFrom, filterTo } = request.query;

		if (!patientid) {
			return response.status(400).send({ error: 'Missing required parameter: patientid' });
		}

		const filterFromDate = filterFrom ? new Date(filterFrom as string) : null
		const filterToDate = filterTo ? new Date(filterTo as string) : null


		const parsedCount = parseInt(count as string, 10);
		const parsedPage = parseInt(page as string, 10);

		if (isNaN(parsedCount) || isNaN(parsedPage)) {
			return response.status(400).send({ error: 'Invalid count or page parameter' });
		}
		const tenantId: number = parseInt(request.query.tenantId.toString(), 10);
		const vitalSignInstance = new VitalSign(parseInt(patientid as string, 10));
		const vitalSigns = await vitalSignInstance.getPatientVitalSignList(tenantId, parsedCount, parsedPage, filterFromDate, filterToDate);

		response.send({ vitalSigns });
	} catch (err) {
		console.log(err)
		response.status(500).send({ error: 'An error occurred while fetching vital signs' });
	}
}

