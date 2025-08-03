import KnexConnection from "../../database/KnexConnections";

export interface OutsourcedTestTracking {
     id?: number;
     serviceid: number;
     testid: number;
     employeeid: number;
     status: number;
     comments: string;
     createdOn?: Date | string;
     updatedOn?: Date | string;
     outsourceid: number;
     completedconfirmedby?: number;
}

export class OutsourcedTestTrackingRepo {
     /**
      * Aggregate profit per test: (outsourcePrice - totalpayable) grouped by testid
      * Joins outsourceorganizationservices and dboservices
      */
     async getProfitPerTestByOutsource(outsourceid?: number) {
          const conn = await this.getConn();
          let query = conn('outsourcedtesttracking')
               .innerJoin('outsourceorganizationservices', function () {
                    this.on('outsourcedtesttracking.outsourceid', '=', 'outsourceorganizationservices.outsourceid')
                         .andOn('outsourcedtesttracking.testid', '=', 'outsourceorganizationservices.generalTestId');
               })
               .innerJoin('dboservices', 'outsourcedtesttracking.serviceid', 'dboservices.serviceid')
               .select(
                    'outsourcedtesttracking.testid',
                    conn.raw('SUM(outsourceorganizationservices.outsourcePrice) as totalOutsourcePrice'),
                    conn.raw('SUM(dboservices.totalpayable) as totalPayable'),
                    conn.raw('SUM(outsourceorganizationservices.outsourcePrice - dboservices.totalpayable) as profit')
               )
               .groupBy('outsourcedtesttracking.testid');
          if (outsourceid !== undefined) {
               query = query.where('outsourcedtesttracking.outsourceid', outsourceid);
          }
          return await query;
     }
     private tenantId: number;
     constructor(tenantId: number) {
          this.tenantId = tenantId;
     }

     private async getConn() {
          return await KnexConnection(this.tenantId);
     }

     async create(data: OutsourcedTestTracking, trx?: any): Promise<number> {
          const conn = trx || await this.getConn();
          if (!data.serviceid || !data.testid || !data.employeeid || !data.outsourceid) {
               throw new Error("Missing required fields: serviceid, testid, employeeid, or outsourceid");
          }
          const [id] = await conn("outsourcedtesttracking").insert({
               serviceid: data.serviceid,
               testid: data.testid,
               employeeid: data.employeeid,
               status: data.status || 0,
               comments: data.comments || '',
               createdOn: new Date(),
               updatedOn: new Date(),
               outsourceid: data.outsourceid,
               completedconfirmedby: data.completedconfirmedby || null,
          });
          return id;
     }

     async getById(id: number): Promise<OutsourcedTestTracking | null> {
          const conn = await this.getConn();
          const row = await conn("outsourcedtesttracking").where({ id }).first();
          return row || null;
     }

     async update(id: number, data: Partial<OutsourcedTestTracking>) {
          const conn = await this.getConn();
          await conn("outsourcedtesttracking").where({ id }).update(data);
          return await this.getById(id);
     }

     async delete(id: number) {
          const conn = await this.getConn();
          return await conn("outsourcedtesttracking").where({ id }).del();
     }

     async list(filter: Partial<OutsourcedTestTracking> = {}) {
          const conn = await this.getConn();
          return await conn("outsourcedtesttracking").where(filter);
     }

     // Analytics
     async countByStatus(status: number) {
          const conn = await this.getConn();
          const result = await conn("outsourcedtesttracking")
               .where({ status })
               .count("id as count");
          return result[0]?.count || 0;
     }

     async getByOutsourceOrg(outsourceid: number) {
          const conn = await this.getConn();
          return await conn("outsourcedtesttracking")
               .innerJoin('outsourcedorgs', 'outsourcedtesttracking.outsourceid', 'outsourcedorgs.id')
               .select('outsourcedtesttracking.*', 'outsourcedorgs.name as outsourceOrgName')
               .where('outsourcedtesttracking.outsourceid', outsourceid)
               .orderBy('outsourcedtesttracking.createdOn', 'desc');
     }

     async getTestOutsourcedCountAndFinances() {
          const conn = await this.getConn();
          return await conn("outsourcedtesttracking")
               .innerJoin('test_panels', 'outsourcedtesttracking.testid', 'test_panels.id')
               .innerJoin('dboservices', 'outsourcedtesttracking.serviceid', 'dboservices.serviceid')
               .select('outsourcedtesttracking.*',
                    'test_panels.name as testName',
                    'dboservices.totalpayable')
     }


     async getTotalAmountByTestOutsourced(outsourcedid?: number) {
          const conn = await this.getConn();
          let query = conn('outsourcedtesttracking')
               .innerJoin('dboservices', 'outsourcedtesttracking.serviceid', 'dboservices.serviceid')
               .select('outsourcedtesttracking.testid')
               .sum('dboservices.totalpayable as totalAmount');
          if (outsourcedid !== undefined) {
               query = query.where('outsourcedtesttracking.outsourceid', outsourcedid);
          }
          query = query.groupBy('outsourcedtesttracking.testid');
          return await query;
     }

     async getOursourcedTestCasesPaginated(
          page: number = 1,
          limit: number = 10,
          sortby: 'ASC' | 'DESC' = 'DESC',
     ) {
          const conn = await this.getConn();
          return await conn('outsourcedtesttracking')
               .innerJoin('dboservices', 'outsourcedtesttracking.serviceid', 'dboservices.serviceid')
               .innerJoin('outsourceorganizationservices', function () {
                    this.on('outsourcedtesttracking.outsourceid', '=', 'outsourceorganizationservices.outsourceid')
                         .andOn('outsourcedtesttracking.testid', '=', 'outsourceorganizationservices.generalTestId');
               })
               .select('outsourcedtesttracking.*', 'dboservices.*', 'outsourceorganizationservices.*')
               .orderBy(`outsourcedtesttracking.createdOn`, sortby)
               .limit(limit)
               .offset((page - 1) * limit);
     }

     /**
      * Join outsourcedtesttracking with dboservices and calculate profit per record
      * Profit = totalpayable - outsourcePrice
      */
     async getProfitByOutsourcedTest(outsourceid?: number, testid?: number) {
          const conn = await this.getConn();
          let query = conn('outsourcedtesttracking')
               .innerJoin('dboservices', 'outsourcedtesttracking.serviceid', 'dboservices.serviceid')
               .innerJoin('outsourceorganizationservices', function () {
                    this.on('outsourcedtesttracking.outsourceid', '=', 'outsourceorganizationservices.outsourceid')
                         .andOn('outsourcedtesttracking.testid', '=', 'outsourceorganizationservices.generalTestId');
               })
               .select(
                    'outsourcedtesttracking.id',
                    'outsourcedtesttracking.testid',
                    'outsourcedtesttracking.serviceid',
                    'dboservices.totalpayable',
                    conn.raw('(dboservices.totalpayable - outsourceorganizationservices.outsourcePrice) as profit')
               );
          if (outsourceid !== undefined) {
               query = query.where('outsourcedtesttracking.outsourceid', outsourceid);
          }
          if (testid !== undefined) {
               query = query.where('outsourcedtesttracking.testid', testid);
          }
          return await query;
     }


}
