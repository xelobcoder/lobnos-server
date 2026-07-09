import { promisifyQuery } from "../../hooks/helper";

export class CustomTest {
	private billingid: number;
	private testname: string;
	constructor(billingid: number, testname: string) {
		this.billingid = billingid;
		this.testname = testname;
	}

	public async getAllCustomTestList(tenantId: number) {
		const query = `SELECT * FROM test_panels WHERE iscustom = 1`;
		return await promisifyQuery(tenantId, query);
	}
	public async loadTestWithDetails(tenantId: number) {
		const query = `SELECT * FROM test_panels AS tp INNER JOIN testdetails AS td ON  td.testid = tp.id`;
		return await promisifyQuery(tenantId, query);
	}

	public async isCustomTest(tenantId: number, testname: string) {
		if (!testname) throw new Error("testname required");
		const query = `SELECT * FROM test_panels WHERE name = ?`;
		const result = await promisifyQuery(tenantId, query, [testname]);
		if (result.length === 0) return null;
		return result[0]["iscustom"] == 1;
	}
}


