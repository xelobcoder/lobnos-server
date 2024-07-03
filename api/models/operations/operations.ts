import {
  q_approved_samples,
  q_billing_test_collection,
  q_checkbillingid,
  q_get_all_entered_result,
  q_get_all_result_entry_base,
  q_get_all_result_entry_partitioning,
  q_get_all_test_preview,
  q_log_result_entry,
  q_qualifiedToProcessByDepartment,
  q_startProcessingTest,
  q_ultrasound_processed_list,
  q_ultrasound_waitingList,
} from "./queries";
import { OperationsFailures, OperationsFilterResultEntry, ProcessedScan, resultQuery } from "./types";

import { customError, promisifyQuery, paginationQuery, responseError, rowAffected } from "../../../helper";

import PartitionManager from "../billing/partitioning";

export default class Operations {
  public billingid: number;
  constructor(billingid: number) {
    this.billingid = billingid;
  }

  async isvalidBillingid(): Promise<boolean> {
    const result = await promisifyQuery(q_checkbillingid, [this.billingid]);
    return result.length === 0;
  }

  async readyforTest(): Promise<boolean | string> {
    const validId = await this.isvalidBillingid();
    if (!validId) {
      return "Invalid billingid";
    }
    if (validId) {
      const result = await promisifyQuery(q_approved_samples, [this.billingid]);
      return !(result.length === 0);
    }
  }

  async getLaboratoryTestReadyForResultEntry(departmentid: number | string): Promise<[] | string> {
    const certified = await this.readyforTest();
    if (!certified) return OperationsFailures.notready;

    if (!departmentid || (typeof departmentid == "string" && departmentid != "all")) {
      throw new Error("departmentid not provided or wrong format provided");
    }

    const values = [];
    let queryString = q_billing_test_collection;

    if (typeof departmentid == "number") {
      queryString += ` AND tp.category =  ?`;
      values.push(departmentid);
    }

    queryString += ` AND ta.collection = 'true' AND ta.ready='false'  AND d.department <> 'ultrasound' `;
    return await promisifyQuery(queryString, values);
  }

  public async getAllQualifiedToProcessByDepartment(category: number | string, count: number, page: number): Promise<[]> {
    //  we want to return all test whose sample was approved and ready to be processed
    let queryString = q_qualifiedToProcessByDepartment;
    const values = [];
    if (category != "all") {
      queryString += ` AND tp.category = ?`;
      values.push(category);
    }
    values.push(count);
    values.push(page - 1 * count);
    queryString += ` AND ta.collection = 'true' AND ta.ready='false' AND d.department <> 'ultrasound' 
    GROUP BY np.patientid ORDER BY b.billingid ASC LIMIT ? OFFSET ?`;
    return await promisifyQuery(queryString, values);
  }

  initiateTestProcessing = async (testid: number, billingid: number) => {
    const is_updated = await promisifyQuery(q_startProcessingTest, [billingid, testid]);
    return rowAffected(is_updated);
  };

  logResultEntry = async (testid: number, billingid: number) => {
    // update test ascension table with the testid, datetime and the billing id and ready = true and ready_date = NOW()
    const isResultEntryLogged = await promisifyQuery(q_log_result_entry, [billingid, testid]);
    return rowAffected(isResultEntryLogged);
  };
  async getAllCasesResultEntryByMany(requestQuery: OperationsFilterResultEntry): Promise<any[]> {
    const { fullname, count = 10, page = 1, departmentid, testid, status, from, to } = requestQuery;
    try {
      let queries: string[] = [];
      let finalQuery: string;
      const values: any[] = [];
      const conditions: string[] = [];
      const hasDuration = from && to;
      const providedFrom = new Date(new Date(from));
      const providedTo = new Date(new Date(to));
      const hasSameMonth = providedFrom.getMonth() === providedTo.getMonth();
      const hasSameYear = providedFrom.getFullYear() === providedTo.getFullYear();

      function getPartitionTableName(baseName: string, currentDate = new Date()): string {
        const year = currentDate.getFullYear();
        const month = `${currentDate.getMonth() + 1}`.padStart(2, "0");
        return `${baseName}_${year}_${month}`;
      }

      if (hasDuration && !(hasSameMonth && hasSameYear)) {
        let billingPartitions = await new PartitionManager("billing", "billing").TablePartitionPrunner(from, to);
        let testAscensionsPartions = await new PartitionManager("test_ascension", "asc").TablePartitionPrunner(from, to);
        const canMove = typeof billingPartitions === "string" && typeof testAscensionsPartions === "string";
        if (canMove) {
          const query = q_get_all_result_entry_partitioning
            .replace("{billing_table}", billingPartitions)
            .replace("{asc_table}", testAscensionsPartions);
          finalQuery = query;
        } else {
          finalQuery = q_get_all_result_entry_base.replace("{billing_table}", "billing").replace("{asc_table}", "test_ascension");
        }
      } else if (hasDuration && hasSameMonth && hasSameYear) {
        const billingTable = getPartitionTableName("billing");
        const ascTable = getPartitionTableName("asc");
        const query = q_get_all_result_entry_partitioning.replace("{billing_table}", billingTable).replace("{asc_table}", ascTable);
        finalQuery = query;
      } else {
        finalQuery = q_get_all_result_entry_base.replace("{billing_table}", "billing").replace("{asc_table}", "test_ascension");
      }

      if (fullname) {
        conditions.push(`CONCAT(np.firstname, ' ', np.middlename, ' ', np.lastname) LIKE ?`);
        values.push(`${fullname}%`);
      }

      if (departmentid && departmentid !== "all") {
        conditions.push(`tp.category = ?`);
        values.push(departmentid);
      }

      if (status === "completed") {
        conditions.push(`ta.ready = 'true'`);
      } else if (status === "pending") {
        conditions.push(`ta.ready = 'false'`);
      }

      if (testid && !isNaN(testid)) {
        conditions.push(`ta.testid = ?`);
        values.push(testid);
      }

      if (from && to) {
        conditions.push(`DATE(b.billedon) BETWEEN ? AND ?`);
        values.push(from, to);
      } else if (from) {
        conditions.push(`DATE(b.billedon) BETWEEN ? AND CURRENT_DATE`);
        values.push(from);
      }

      if (conditions.length > 0) {
        finalQuery += ` AND ${conditions.join(" AND ")} `;
      }

      finalQuery += `
      ORDER BY billingid DESC
      LIMIT ? OFFSET ?
    `;

      return await paginationQuery({ count, page }, finalQuery, values);
    } catch (err) {
      throw err;
    }
  }

  async getAllEnterResult(data: resultQuery) {
    const { from, to, patientid, billingid, sortingwise, count, page } = data;
    let queryString = q_get_all_entered_result;
    queryString += ` WHERE ss.approvalstatus = 1 AND d.department <> 'ultrasound'`;

    if (from && !to) {
      queryString += ` AND DATE(b.billedon) BETWEEN '${from}' AND CURRENT_DATE`;
    } else if (from && to) {
      queryString += ` AND DATE(b.billedon) BETWEEN '${from}' AND  '${to}'`;
    } else {
      queryString = queryString;
    }

    if (patientid) {
      queryString += ` AND np.PATIENTID = ${patientid}`;
    }

    if (billingid) {
      queryString += ` AND b.billingid = ${billingid}`;
    }

    queryString += ` GROUP BY b.billingid DESC LIMIT 30`;

    let result = await promisifyQuery(queryString);

    if (result.length > 0) {
      const getTestQuery = ` SELECT ta.testid,
                          tp.name,
                          ta.billingid,
                          tp.category,
                          ta.processing,
                          ta.processing_date,
                          ta.ready,
                          ta.ready_date
                        FROM test_ascension as ta
                          INNER JOIN test_panels as tp ON ta.testid = tp.id
                          INNER JOIN departments AS d ON d.id = tp.category
       WHERE ta.billingid = ?`;
      result = await Promise.all(
        result.map(async (item, index) => {
          const { billingid } = item;
          if (billingid) {
            const test_outcome = await promisifyQuery(getTestQuery, [parseInt(billingid)]);
            item.testMap = test_outcome;
          }
          return item;
        })
      );
    }
    return result;
  }

  getAllTestPreview = async function (billingid: number) {
    if (billingid) {
      const alltest = await promisifyQuery(q_get_all_test_preview, [billingid]);
      return alltest;
    }
  };

  async getUltrasoundWaitingList(data: { count: number; page: number }) {
    const { count = 10, page = 1 } = data;
    const result = await paginationQuery({ count, page }, q_ultrasound_waitingList);
    return result;
  }

  public async processedScanList(data: ProcessedScan) {
    try {
      const { from, to, search, count = 10, page = 1 } = data;
      const values = [];
      const conditions = [`d.department = 'ultrasound'`, `ta.ready = 'true'`];

      if (from) {
        conditions.push(`DATE(b.billedon) BETWEEN ? AND ?`);
        values.push(from, to || "CURRENT_DATE");
      }

      if (search) {
        conditions.push(`(CONCAT(np.firstname, ' ', np.middlename, ' ', np.lastname) LIKE ? OR np.MOBILE_NUMBER = ?)`);
        values.push(`%${search}%`, search);
      }

      let whereClause = "";
      if (conditions.length > 0) {
        whereClause = "WHERE " + conditions.join(" AND ");
      }

      const query = q_ultrasound_processed_list;
      values.unshift(whereClause);

      return await paginationQuery({ count, page }, query, values);
    } catch (err) {
      throw new Error(err);
    }
  }
}
