import { Request, Response } from "express";
import Payment from "../../models/payments/payments";
import Branch from "../../models/application/branches/branches";


type GeneralSalesTarget = "yearly" | "monthly" | "daily" | "weekly";


// Sales Handlers
export const handleGeneralSalesSummary = (
	req: Request<{}, {}, {}, { tenantId: string; target: GeneralSalesTarget; branch: string; clinicianid: number; patientid: number }>,
	res: Response
) => {
	const tenantId: number = parseInt(req.query.tenantId, 10);
	const { target, branch, clinicianid, patientid } = req.query;

	if (!target || !["yearly", "monthly", "daily", "weekly"].includes(target as string) || !branch) {
		res.status(400).send({
			status: "error",
			message: "Please provide a target and include branch in request query",
		});
	} else {
		
	}
};

export const handleSalesSummaryRange = async (
	req: Request<{}, {}, {}, { tenantId: string; branchid: string; employeeid: string,to:string,from:string }>,
	res: Response
) => {
	try {
		const tenantId: number = parseInt(req.query.tenantId, 10);
		const { branchid, employeeid ,from,to} = req.query;
		const parsedBranchid = parseInt(branchid)
		const summary  = await new Payment(null).summaryRangeOfDates(tenantId,from,to,parsedBranchid);
		const branch = await Branch.find(tenantId,parsedBranchid);
		res.send({summary,branch})
	} catch (err) {
		res.status(500).send({ status: "error", message: "Internal server error" });
	}
};
