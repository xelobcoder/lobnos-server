import { AscensionParameter, billErrors, BreakingPoint, IBillNewClient, Pagination, TBillingData } from "./billingclientTypes";
import { promisifyQuery, rowAffected } from "./../../../helper.js";

import {
  AddtoTestAscenstionQuery,
  currentDateBilledClients,
  deleteAscensionidQuery,
  deleteBillTransactionQuery,
  deleteNewBillPaymentHx,
  insertBillQuery,
  patientBilledTodayQuery,
  q_addNewPartition,
  q_getAllpartiton,
  updatebillHistoryQuery,
} from "./queries";


import { reOrganizePartitionBilling } from "./partitioning";

export class Billing implements IBillNewClient {
  readonly patientid: number;
  constructor(patientid: number) {
    this.patientid = patientid;
  }
  public async getTransactionBillData(billingid: number): Promise<[]> {
    return await promisifyQuery(`SELECT * FROM billing WHERE billingid  =? `, [billingid]);
  }

  public async getBranchDayBilledClients(branchid: number, { count = 10, page = 1 }: Pagination): Promise<[]> {
    const currentDate = new Date();
    let currentYear = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const day = currentDate.getDate();
    const result: [] = await promisifyQuery(currentDateBilledClients, [currentYear, month, day, branchid]);
    return result;
  }
  public wrapperTryCatch<T>(cb: () => T, errcb: (_err: any) => void): T | null {
    try {
      return cb();
    } catch (err) {
      if (errcb && typeof errcb == "function") {
        errcb(err);
      } else {
        console.error("Error uncaught in and unhandled", err);
      }
    }
  }

  private static async initPartitionBilling(prefix: string, year: number) {
    var query: string = `ALTER TABLE billing  PARTITION BY RANGE COLUMNS (year,month) 
    (`;
    let range: number = 1;
    while (range <= 12) {
      const month = `${range}`.padStart(2, "0");
      if (range == 12) {
        query += `PARTITION ${prefix}_${year}_${month} VALUES LESS THAN (${year + 1}, ${1})`;
      } else {
        query += `PARTITION ${prefix}_${year}_${month} VALUES LESS THAN (${year}, ${range + 1}),`;
      }
      range++;
    }
    query += ` )`;
    const result = await promisifyQuery(query);
    return result.affectedRows;
  }

  private static async getBillingTablePartions() {
    const packets = await promisifyQuery(q_getAllpartiton);
    return packets[0]["PARTITION_NAME"] != null ? packets : [];
  }

  private static async partitionstoYearList(data: []) {
    const packets = data || (await this.getBillingTablePartions());
    return packets.length === 0 ? [] : packets.map((item: any, index: number) => item.PARTITION_NAME.split("_")[1]);
  }

  private static async partitionsStrings(packets: []) {
    if (Array.isArray(packets) && packets.length > 0) {
      return packets.map((item: any, index: number) => item.PARTITION_NAME);
    }
    return [];
  }

  private static async billingPartitionPrunner(startdate: string, enddate: string) {
    if (!startdate || !startdate) throw new Error("required startdate and enddate not provided");
    let partitions = await this.getBillingTablePartions();
    if (partitions.length == 0) return [];

    const startYear = new Date(startdate).getFullYear();
    const endYear = new Date(enddate).getFullYear();
    const stMonth = new Date(startdate).getMonth();
    const edMonth = new Date(enddate).getMonth();

    partitions = partitions.map((a, index: number) => a.PARTITION_NAME);

    partitions.filter((_part, index) => {
      const [_, year, month] = _part.split("_");
      return year == startYear || year == endYear || (endYear == year && stMonth == month) || (startYear == year && edMonth == month);
    });
    return partitions.length > 0 ? partitions.join(",") : [];
  }

  private static async executeAddPartitionBilling(_partition_name: string, year: number, month: number) {
    return await promisifyQuery(q_addNewPartition(_partition_name, year, month));
  }

  async dropPartition(partitionName: string) {
    return await promisifyQuery(`ALTER TABLE billing DROP PARTITION \`${partitionName}\``);
  }

  /**
   * Adds partitions for the given year to the billing table.
   *
   * @param {number} year - The year for which to add partitions. If not provided, defaults to the current year.
   * @returns {Promise<boolean>} - Returns true if the operation is successful, otherwise throws an error.
   */
  async AddYearPartition(year: number): Promise<boolean> {
    let currentYear: number = year || new Date().getFullYear();

    // Retrieve current partitions from the billing table.
    const partitions = await Billing.getBillingTablePartions();
    const _currentPartitions: number[] = await Billing.partitionstoYearList(partitions);

    // Initialize partition if no current partitions are found.
    if (_currentPartitions.length === 0) {
      await Billing.initPartitionBilling("billing", currentYear);
      return true;
    }

    /**
     * Adds a partition for the given range.
     *
     * @param {number} range - The range (month) for the partition.
     * @returns {Promise<boolean>} - Returns true if the partition is added successfully, false otherwise.
     */
    const pushPartition = async (range: number): Promise<boolean> => {
      try {
        const _range = `${range}`.padStart(2, "0");
        const partitionName = `billing_${currentYear}_${_range}`;
        if (range !== 12) {
          await Billing.executeAddPartitionBilling(partitionName, currentYear, range + 1);
        } else {
          await Billing.executeAddPartitionBilling(partitionName, currentYear + 1, 1);
        }
        return true;
      } catch (err) {
        console.log(err);
        return false;
      }
    };

    /**
     * Creates partitions for the missing ranges.
     *
     * @param {number[]} availablePartitions - Array of ranges (months) for which partitions to be added.
     */
    const loop_create_partition = async (availablePartitions: number[]) => {
      for (let i = 0; i < availablePartitions.length; i++) {
        const outcome = await pushPartition(availablePartitions[i]);
        console.warn(outcome);
      }
    };

    if (_currentPartitions.includes(currentYear) === false) {
      loop_create_partition([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    }

    const parsePartitionString = (partition: string, index: number): number => {
      return parseInt(partition.split("_")[index]);
    };

    if (!_currentPartitions.includes(currentYear)) {
      let current = 0;
      let uniqueYears = [];

      const availablePartitions: string[] = await Billing.partitionsStrings(partitions);

      // get all uniques years
      while (current < availablePartitions.length) {
        const year = parsePartitionString(availablePartitions[current], 1);
        if (!uniqueYears.includes(year)) {
          uniqueYears.push(year);
        }
        current++;
      }

      for (const year of uniqueYears) {
        const _yearPartitions = availablePartitions.filter((item, index) => parsePartitionString(item, 1) === year);

        let breakingpoint: BreakingPoint[] = [];
        let _incremental = 0;

        let parsedMonths = _yearPartitions.map((item, index) => parsePartitionString(item, 2));

        while (_incremental < parsedMonths.length) {
          let hasMissedGaps: boolean = false;
          const now = parsedMonths[_incremental];
          const next = parsedMonths[_incremental + 1];
          if (next !== undefined) {
            hasMissedGaps = next - now > 1;
            if (hasMissedGaps) {
              breakingpoint.push({ min: now, max: next });
            }
          }
          _incremental++;
        }

        if (breakingpoint.length == 0) {
          let start = parsedMonths[parsedMonths.length - 1] + 1;
          let missingPartition: number[] = [];
          while (start <= 12) {
            missingPartition.push(start);
            start++;
          }
          loop_create_partition(missingPartition);
        } else {
          let init = 0;

          while (init < breakingpoint.length) {
            const { min, max } = breakingpoint[init];
            await reOrganizePartitionBilling(max, min, year);
            init++;
          }
        }
      }
    }

    return true;
  }

  public async insertNewBilling() {}
  async billClient(data: TBillingData): Promise<number | boolean> {
    try {
      const {
        patientid,
        clinician = 0,
        organization = 0,
        paid,
        payable,
        outstanding,
        discount,
        samplingCenter,
        taxIncluded,
        taxValue,
        status,
        testcost,
        employeeid,
        type,
      } = data;

      const date = new Date();
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const partitionName = `billing_${year}_${month}`;

      const values: (string | number | boolean)[] = [
        patientid,
        clinician,
        organization,
        paid,
        payable,
        type,
        outstanding,
        discount,
        samplingCenter,
        taxIncluded,
        taxValue,
        status,
        testcost,
        employeeid,
      ];

      const { affectedRows, insertId } = await promisifyQuery(insertBillQuery, values);
      if (affectedRows == 0) return false;
      return insertId;
    } catch (err) {
      console.error(err);
      throw new Error(billErrors.error);
    }
  }

  public async isCompleteFlow() {
    const settings = await promisifyQuery(`SELECT * FROM applicationsettings`);
    if (settings.length == 0) return false;
    return settings[0]["completeFlow"] == 1 ? true : false;
  }

  public async updateBillingHistory(paymentmode: number, billingid: number, amount: number) {
    const values: number[] = [paymentmode, amount, billingid];
    return await promisifyQuery(updatebillHistoryQuery, values);
  }

  public updateApprovalStatus = async function (billingid: number, testid: number) {
    try {
      const query = `UPDATE samplestatus SET approvalstatus = 1 WHERE billingid = ? AND testid = ?`;
      const values = [billingid, testid];
      return promisifyQuery(query, values);
    } catch (err) {
      throw new Error(err);
    }
  };

  public async deleteAscensionid(billingid: number, testid: number) {
    const result = await promisifyQuery(deleteAscensionidQuery, [billingid, testid]);
    return rowAffected(result);
  }

  public async haveBeenBilledToday(patientid: number): Promise<boolean> {
    const result = await promisifyQuery(patientBilledTodayQuery, patientid);
    return !(result[0]["count"] > 0);
  }

  private async deleteAddedWithError(inserted: number[], billingid: number) {
    let counter: number = 0;
    while (inserted.length > 0 && counter <= inserted.length) {
      const isDeleted = rowAffected(await this.deleteAscensionid(billingid, inserted[counter]));
      if (isDeleted) {
        inserted = inserted.filter((a) => a != inserted[counter]);
      }
      counter++;
    }
  }
  public async AddtoTestAscenstion(data: AscensionParameter): Promise<boolean> {
    const { billingid, testidCollection } = data;
    let insertionCount = 0;
    const inserted: number[] = [];
    try {
      if (testidCollection.length == 0) throw new Error("Bad Parameters, testCollection not added");
      const collected = (await this.isCompleteFlow()) ? "false" : "true";
      for (let i = 0; i < testidCollection.length; i++) {
        const testid = testidCollection[i];
        const isInserted: boolean = await promisifyQuery(AddtoTestAscenstionQuery, [testid, billingid, collected]);
        if (!isInserted) throw new Error(billErrors.failed);
        insertionCount++;
        inserted.push(testid);
        if (!collected) {
          await this.updateApprovalStatus(billingid, testid);
        }
      }
      return insertionCount === testidCollection.length;
    } catch (err) {
      await this.deleteAddedWithError(inserted, billingid);
      throw new Error(err?.message || err);
    }
  }

  public async deleteBillTransaction(billingid: number) {
    return await promisifyQuery(deleteBillTransactionQuery, [billingid]);
  }

  async cleanUpRecordedPaymentHx(billingid: number): Promise<void> {
    await promisifyQuery(deleteNewBillPaymentHx, billingid);
  }

  public async insertionProcess(billingData: TBillingData, strict: boolean = true): Promise<boolean | string> {
    // strict can be replaced with database value for strict checking to be done
    let isHistoryAdded = false;
    let isAscAdded = false;
    let billingid = undefined;
    try {
      let canInitiateNewBill = true;
      if (strict) {
        canInitiateNewBill = await this.haveBeenBilledToday(this.patientid);
      }

      if (!canInitiateNewBill) {
        return billErrors.already;
      }
      billingid = await this.billClient(billingData);

      if (typeof billingid == "boolean" || !billingid) return billErrors.failed;

      isAscAdded = await this.AddtoTestAscenstion({ billingid, testidCollection: billingData.test });
      isHistoryAdded = rowAffected(await this.updateBillingHistory(billingData.paymentmode, billingid, billingData.paid));
      if (isAscAdded && isHistoryAdded && billingid) {
        return true;
      }
      await this.deleteBillTransaction(billingid);
      return billErrors.failed;
    } catch (err) {
      if (billingid) {
        await this.deleteBillTransaction(billingid);
      }
      return billErrors.error;
    }
  }
}

