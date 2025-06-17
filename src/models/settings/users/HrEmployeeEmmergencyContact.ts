import KnexConnection from "../../../database/KnexConnections";
import { HrEmployeeEmergencyContact } from "./HrEmployeeEmergencyContInterfaces";


export default class HrEmployeeEmergencyContactsRepository {
    private connection;
    private tablename: string = 'hr_employeemergencycontacts';

    constructor(tenantId: number) {
        this.connection = KnexConnection(tenantId);
    }

    async createContact(contactData: Partial<HrEmployeeEmergencyContact>): Promise<number> {
        const connection = await this.connection;
        const result = await connection(this.tablename).insert(contactData).returning('contactid');
        return result[0];
    }

    async getContactById(contactId: number): Promise<HrEmployeeEmergencyContact | undefined> {
        const connection = await this.connection;
        return connection(this.tablename).where({ contactid: contactId }).first();
    }

    async getContactsByEmployee(employeeId: number): Promise<HrEmployeeEmergencyContact[]> {
        const connection = await this.connection;
        return connection(this.tablename).where({ employeeid: employeeId });
    }

    async updateContact(contactId: number, contactData: Partial<HrEmployeeEmergencyContact>): Promise<number> {
        const connection = await this.connection;
        return connection(this.tablename).where({ contactid: contactId }).update(contactData);
    }

    async deleteContact(contactId: number): Promise<number> {
        const connection = await this.connection;
        return connection(this.tablename).where({ contactid: contactId }).del();
    }

    async getAllContacts(): Promise<HrEmployeeEmergencyContact[]> {
        const connection = await this.connection;
        return connection(this.tablename).select('*');
    }
}