"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const helper_1 = require("../../../helper");
const logger_1 = __importDefault(require("../../../logger"));
const queries_1 = require("./queries");
const defaultSalesParam = {
    discountedAmount: 0,
    payable: 0,
    commissionRate: 0,
    referedCases: 0,
};
class Organization {
    constructor(organizationId) {
        this.organizationId = organizationId;
    }
    async getCommissionRate() {
        let commissionRate = 0;
        const organizationInfo = await this.organizationAccountInfo();
        if (organizationInfo.length !== 0 && organizationInfo[0]["commission"] !== 0) {
            commissionRate = organizationInfo[0]["commission"];
        }
        return commissionRate;
    }
    async calculateRate(data) {
        const commissionRate = await this.getCommissionRate();
        const payable = data[0]["payable"];
        const rate = parseFloat(payable) * (parseFloat(commissionRate.toString()) / 100);
        return Object.assign(Object.assign({}, data[0]), { commissionRate: rate });
    }
    async monthSales() {
        try {
            let monthly = await (0, helper_1.promisifyQuery)(queries_1.MONTHLYSALESQUERY, [this.organizationId]);
            if (monthly.length === 0) {
                return defaultSalesParam;
            }
            monthly = await this.calculateRate(monthly);
            return monthly;
        }
        catch (err) {
            throw new Error(err);
        }
    }
    async daySales() {
        try {
            let result = await (0, helper_1.promisifyQuery)(queries_1.TODAYSALESQUERY, [this.organizationId]);
            if (result.length === 0) {
                return defaultSalesParam;
            }
            result = await this.calculateRate(result);
            return result;
        }
        catch (err) {
            throw new Error(err);
        }
    }
    async weeklySales() {
        try {
            const commissionRate = await this.getCommissionRate();
            let result = await (0, helper_1.promisifyQuery)(queries_1.WEEKLYSALESQUERY, [this.organizationId]);
            if (result.length === 0) {
                return [];
            }
            result = result.map((item) => {
                const commission = parseFloat(item === null || item === void 0 ? void 0 : item.payable) * (parseFloat(commissionRate.toString()) / 100);
                return Object.assign(Object.assign({}, item), { value: commission, name: item === null || item === void 0 ? void 0 : item.weeklySales });
            });
            return result;
        }
        catch (err) {
            throw new Error(err);
        }
    }
    async getYearlySales() {
        try {
            let result = await (0, helper_1.promisifyQuery)(queries_1.YEARLYSALESQUERY, [this.organizationId]);
            if (result.length === 0) {
                return defaultSalesParam;
            }
            result = await this.calculateRate(result);
            return result;
        }
        catch (err) {
            throw new Error(err);
        }
    }
    async getDailySales() {
        try {
            let result = await (0, helper_1.promisifyQuery)(queries_1.DAILYSALESQUERY, [this.organizationId]);
            result = await Promise.all(result.map(async (a) => await this.calculateRate([a])));
            return result;
        }
        catch (err) {
            throw new Error(err);
        }
    }
    async organizationAccountInfo() {
        return await (0, helper_1.promisifyQuery)(queries_1.q_accountInfo, [this.organizationId]);
    }
    async getOrganizationInfo() {
        return await (0, helper_1.promisifyQuery)("SELECT * FROM organization WHERE id = ?", [this.organizationId]);
    }
    async generateSalesReport() {
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
        }
        catch (err) {
            logger_1.default.error(err);
            throw new Error(err);
        }
    }
}
exports.default = Organization;
