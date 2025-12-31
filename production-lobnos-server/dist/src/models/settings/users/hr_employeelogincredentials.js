"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
class HrEmployeeLoginCredentialsRepository {
    constructor(tenantId) {
        this.tablename = 'hr_employeelogincredentials';
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async createCredentials(credentialsData) {
        const connection = await this.connection;
        const result = await connection(this.tablename).insert(credentialsData).returning('credentialid');
        return result[0];
    }
    async getCredentialsById(credentialId) {
        const connection = await this.connection;
        return connection(this.tablename).where({ credentialid: credentialId }).first();
    }
    async getCredentialsByEmployee(employeeId) {
        const connection = await this.connection;
        return connection(this.tablename).where({ employeeid: employeeId }).first();
    }
    async updateCredentials(credentialId, credentialsData) {
        const connection = await this.connection;
        return connection(this.tablename).where({ credentialid: credentialId }).update(credentialsData);
    }
    async deleteCredentials(credentialId) {
        const connection = await this.connection;
        return connection(this.tablename).where({ credentialid: credentialId }).del();
    }
    async getAllCredentials() {
        const connection = await this.connection;
        return connection(this.tablename).select('*');
    }
}
exports.default = HrEmployeeLoginCredentialsRepository;
