"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
class HrEmployeeEmergencyContactsRepository {
    constructor(tenantId) {
        this.tablename = 'hr_employeemergencycontacts';
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async createContact(contactData) {
        const connection = await this.connection;
        const result = await connection(this.tablename).insert(contactData).returning('contactid');
        return result[0];
    }
    async getContactById(contactId) {
        const connection = await this.connection;
        return connection(this.tablename).where({ contactid: contactId }).first();
    }
    async getContactsByEmployee(employeeId) {
        const connection = await this.connection;
        return connection(this.tablename).where({ employeeid: employeeId });
    }
    async updateContact(contactId, contactData) {
        const connection = await this.connection;
        return connection(this.tablename).where({ contactid: contactId }).update(contactData);
    }
    async deleteContact(contactId) {
        const connection = await this.connection;
        return connection(this.tablename).where({ contactid: contactId }).del();
    }
    async getAllContacts() {
        const connection = await this.connection;
        return connection(this.tablename).select('*');
    }
}
exports.default = HrEmployeeEmergencyContactsRepository;
