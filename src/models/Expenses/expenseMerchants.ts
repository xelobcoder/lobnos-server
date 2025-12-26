
import KnexConnection from "../../database/KnexConnections";
import Expenses from "./ExpenseService";

export interface ExpenseMerchant {
     id?: number;
     name: string;
     email?: string;
     phone?: string;
     address?: string;
     website?: string;
     notes?: string;
     created_at?: Date;
     created_by: number;
     updated_by?: number;
     updated_at?: Date;
}

export default class expenseMerchants {
     connection: any;
     tablename: string;
     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
          this.tablename = 'expense_merchants';
     }

     async findByMerchantName(merchantName: string): Promise<any> {
          const conn = await this.connection;
          const row = await conn(this.tablename).where({ name: merchantName }).first();
          return row;
     }
     async findByMerchantId(merchantId: number): Promise<any> {
          const conn = await this.connection;
          const row = await conn(this.tablename).where({ id: merchantId }).first();
          return row;
     }
     async create(merchantData: any): Promise<any> {
          const conn = await this.connection;
          const [newMerchant] = await conn(this.tablename).insert(merchantData).returning('*');
          return newMerchant;
     }


     async findById(merchantId: number): Promise<any> {
          const conn = await this.connection;
          const row = await conn(this.tablename).where({ id: merchantId }).first();
          return row;
     }

     async update(merchantData: any): Promise<any> {
          const conn = await this.connection;
          const { name, email, phone, address, website, notes, id } = merchantData;
          const dataToUpdate: Partial<ExpenseMerchant> = { name, email, phone, address, website, notes };
          const result = await conn(this.tablename).where({ id: id }).update(dataToUpdate);
          return result;
     }


     async findAll(limit: number = 10, page: number = 1): Promise<any[]> {
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


     async delete(merchantId: number): Promise<void> {
          const conn = await this.connection;
          await conn(this.tablename).where({ id: merchantId }).del();
     }
}
