"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
class expenseMerchants {
    constructor(tenantId) {
        this.connection = (0, KnexConnections_1.default)(tenantId);
        this.tablename = 'expense_merchants';
    }
    async findByMerchantName(merchantName) {
        const conn = await this.connection;
        const row = await conn(this.tablename).where({ name: merchantName }).first();
        return row;
    }
    async findByMerchantId(merchantId) {
        const conn = await this.connection;
        const row = await conn(this.tablename).where({ id: merchantId }).first();
        return row;
    }
    async create(merchantData) {
        const conn = await this.connection;
        const [newMerchant] = await conn(this.tablename).insert(merchantData).returning('*');
        return newMerchant;
    }
    async findById(merchantId) {
        const conn = await this.connection;
        const row = await conn(this.tablename).where({ id: merchantId }).first();
        return row;
    }
    async update(merchantData) {
        const conn = await this.connection;
        const { name, email, phone, address, website, notes, id } = merchantData;
        const dataToUpdate = { name, email, phone, address, website, notes };
        const result = await conn(this.tablename).where({ id: id }).update(dataToUpdate);
        return result;
    }
    async findAll(limit = 10, page = 1) {
        const conn = await this.connection;
        const offset = (page - 1) * limit;
        const rows = await conn(this.tablename)
            .leftJoin('roles', 'expense_merchants.created_by', 'roles.employeeid')
            .select('expense_merchants.*', 'roles.username as created_by_name')
            .orderBy('expense_merchants.created_at', 'desc')
            .limit(limit)
            .offset(offset);
        console.log(rows);
        return rows;
    }
    async delete(merchantId) {
        const conn = await this.connection;
        await conn(this.tablename).where({ id: merchantId }).del();
    }
}
exports.default = expenseMerchants;
