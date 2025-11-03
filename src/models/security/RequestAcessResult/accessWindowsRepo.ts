import KnexConnection from "../../../database/KnexConnections";



interface AccessWindow {
     id?: number;
     employeeid: number;
     category: 'global' | 'individual';
     edit_window: '1h' | '4h' | '8h' | '12h' | '24h' | '1d' | '1w' | '2w' | '1m';
     access_window: '1h' | '4h' | '8h' | '12h' | '24h' | '1d' | '1w' | '2w' | '1m';
     applicable_role: 'scientist' | 'phlebotomist' | 'customer service representative' | 'sonographer';
     require_approval: boolean;
     // Joined fields from roles table
     username?: string;
     email?: string;
     employee_role?: string;
}

export default class AccessWindowsRepo {
     private static readonly TABLE_NAME = 'access_windows';

     static async create(window: Omit<AccessWindow, 'id'>): Promise<number> {
          const connection = await KnexConnection(1);

          if (window.category === 'global') {
               // Ensure only one global record exists
               const existingGlobal = await this.findGlobalSettings();
               if (existingGlobal) {
                    await this.update(existingGlobal.id!, window);
                    return existingGlobal.id!;
               }
          } else if (window.category === 'individual') {
               // Ensure each employee has at most one individual record
               const existingIndividual = await this.findByEmployeeId(window.employeeid);
               if (existingIndividual) {
                    await this.update(existingIndividual.id!, window);
                    return existingIndividual.id!;
               }
          }

          // Create new record if none exists
          const [id] = await connection(this.TABLE_NAME).insert(window);
          return id;
     }

     static async findById(id: number): Promise<AccessWindow | undefined> {
          const connection = await KnexConnection(1);
          return await connection(this.TABLE_NAME)
               .select([
                    `${this.TABLE_NAME}.*`,
                    'roles.username',
                    'roles.email',
                    'roles.role as employee_role'
               ])
               .leftJoin('roles', `${this.TABLE_NAME}.employeeid`, 'roles.employeeid')
               .where({ [`${this.TABLE_NAME}.id`]: id })
               .first();
     }

     static async findByEmployeeId(employeeid: number): Promise<AccessWindow | undefined> {
          const connection = await KnexConnection(1);
          return await connection(this.TABLE_NAME)
               .select([
                    `${this.TABLE_NAME}.*`,
                    'roles.username',
                    'roles.email',
                    'roles.role as employee_role'
               ])
               .leftJoin('roles', `${this.TABLE_NAME}.employeeid`, 'roles.employeeid')
               .where({ [`${this.TABLE_NAME}.employeeid`]: employeeid })
               .first();
     }

     static async findAll({ page, count, tenantId }: { page?: number; count?: number; tenantId: number }): Promise<AccessWindow[]> {
          const connection = await KnexConnection(tenantId);
          let query = connection(this.TABLE_NAME)
               .select([
                    `${this.TABLE_NAME}.*`,
                    'roles.username',
                    'roles.email',
                    'roles.role as employee_role'
               ])
               .leftJoin('roles', `${this.TABLE_NAME}.employeeid`, 'roles.employeeid');

          if (page && count) {
               query = query.limit(count).offset((page - 1) * count);
          }

          return await query;
     } static async update(id: number, updates: Partial<AccessWindow>): Promise<boolean> {
          const connection = await KnexConnection(1);
          const updated = await connection(this.TABLE_NAME).where({ id }).update(updates);
          return updated > 0;
     }

     static async delete(id: number): Promise<boolean> {
          const connection = await KnexConnection(1);
          const deleted = await connection(this.TABLE_NAME).where({ id }).del();
          return deleted > 0;
     }

     static async deleteByEmployeeId(employeeid: number): Promise<boolean> {
          const connection = await KnexConnection(1);
          const deleted = await connection(this.TABLE_NAME).where({ employeeid, category: 'individual' }).del();
          return deleted > 0;
     }

     static async findGlobalSettings(): Promise<AccessWindow | undefined> {
          const connection = await KnexConnection(1);
          return await connection(this.TABLE_NAME)
               .select([
                    `${this.TABLE_NAME}.*`,
                    'roles.username',
                    'roles.email',
                    'roles.role as employee_role'
               ])
               .leftJoin('roles', `${this.TABLE_NAME}.employeeid`, 'roles.employeeid')
               .where({ [`${this.TABLE_NAME}.category`]: 'global' })
               .first();
     }

     static async getEffectiveSettings(employeeid: number): Promise<AccessWindow | undefined> {
          // Try employee-specific settings first
          const employeeSettings = await this.findByEmployeeId(employeeid);
          if (employeeSettings) {
               return employeeSettings;
          }
          // Fall back to global settings
          return await this.findGlobalSettings();
     }
}