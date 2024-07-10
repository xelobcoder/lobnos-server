import { promisifyQuery } from "../../../helper";
import logger from "../../../logger";
import { MONTHLYSALESQUERY, WEEKLYSALESQUERY, DAILYSALESQUERY, TODAYSALESQUERY, YEARLYSALESQUERY } from "./queries";

interface OrganizationInfo {
  id: number;
  commission: number;
}

class Organization {
  private organizationId: number | null;

  constructor(organizationId: number | null) {
    this.organizationId = organizationId;
  }

  private async getCommissionRate(): Promise<number> {
    let commissionRate = 0;
    const organizationInfo = await this.organizationAccountInfo();
    if (organizationInfo.length !== 0 && organizationInfo[0]["commission"] !== 0) {
      commissionRate = organizationInfo[0]["commission"];
    }
    return commissionRate;
  }

  private async calculateRate(data: any[]): Promise<any> {
    const commissionRate = await this.getCommissionRate();
    const payable = data[0]["payable"];
    const rate = parseFloat(payable) * (parseFloat(commissionRate.toString()) / 100);
    return { ...data[0], commissionRate: rate };
  }

  private get defaultSalesParam() {
    return {
      discountedAmount: 0,
      payable: 0,
      commissionRate: 0,
      referedCases: 0,
    };
  }

  public async monthSales(): Promise<any> {
    try {
      let monthly = await promisifyQuery(MONTHLYSALESQUERY, [this.organizationId]);
      if (monthly.length === 0) {
        return this.defaultSalesParam;
      }
      monthly = await this.calculateRate(monthly);
      return monthly;
    } catch (err) {
      throw new Error(err);
    }
  }

  public async daySales(): Promise<any> {
    try {
      let result = await promisifyQuery(TODAYSALESQUERY, [this.organizationId]);
      if (result.length === 0) {
        return this.defaultSalesParam;
      }
      result = await this.calculateRate(result);
      return result;
    } catch (err) {
      throw new Error(err);
    }
  }

  public async weeklySales(): Promise<any[]> {
    try {
      const commissionRate = await this.getCommissionRate();
      let result = await promisifyQuery(WEEKLYSALESQUERY, [this.organizationId]);
      if (result.length === 0) {
        return [];
      }
      result = result.map((item: any) => {
        const commission = parseFloat(item?.payable) * (parseFloat(commissionRate.toString()) / 100);
        return { ...item, value: commission, name: item?.weeklySales };
      });
      return result;
    } catch (err) {
      throw new Error(err);
    }
  }

  public async getYearlySales(): Promise<any> {
    try {
      let result = await promisifyQuery(YEARLYSALESQUERY, [this.organizationId]);
      if (result.length === 0) {
        return this.defaultSalesParam;
      }
      result = await this.calculateRate(result);
      return result;
    } catch (err) {
      throw new Error(err);
    }
  }

  public async getDailySales(): Promise<any[]> {
    try {
      let result = await promisifyQuery(DAILYSALESQUERY, [this.organizationId]);
      result = await Promise.all(result.map(async (a: any) => await this.calculateRate([a])));
      return result;
    } catch (err) {
      throw new Error(err);
    }
  }

  private async organizationAccountInfo(): Promise<OrganizationInfo[]> {
    return await promisifyQuery<OrganizationInfo>("SELECT * FROM organizationaccountinformation WHERE organizationid = ?", [
      this.organizationId,
    ]);
  }

  public async getOrganizationInfo(): Promise<any> {
    return await promisifyQuery("SELECT * FROM organization WHERE id = ?", [this.organizationId]);
  }

  public async generateSalesReport(): Promise<any> {
    try {
      if (!this.organizationId) {
        return false;
      }
      const monthly = await this.monthSales();
      const today = await this.daySales();
      const weekly = await this.weeklySales();
      const daily = await this.getDailySales();
      const yearly = await this.getYearlySales();
      const sales = { monthly, today, weekly, yearly, daily };
      return sales;
    } catch (err) {
      logger.error(err);
      throw new Error(err);
    }
  }
}

export default Organization;
