import KnexConnection from "../../../database/KnexConnections";



interface AccessWindow {
     id?: number;
     employeeid: number;
     category: 'global' | 'individual';
     edit_window: '1h' | '4h' | '8h' | '12h' | '24h' | '1d' | '1w' | '2w' | '1m';
     access_window: '1h' | '4h' | '8h' | '12h' | '24h' | '1d' | '1w' | '2w' | '1m';
     applicable_role: 'scientist' | 'phlebotomist' | 'customer service representative' | 'sonographer';
     require_approval: boolean;
     username?: string;
     email?: string;
     employee_role?: string;
}

export default class AccessWindowsRepo {
     private static readonly TABLE_NAME = 'access_windows';

     static async create(tenantId: number, window: Omit<AccessWindow, 'id'>): Promise<number> {
          const connection = await KnexConnection(tenantId);

          if (window.category === 'global') {
               window.employeeid = 0;
               const existingGlobal = await this.findGlobalSettings(tenantId);
               if (existingGlobal) {
                    await this.update(tenantId, existingGlobal.id!, window);
                    return existingGlobal.id!;
               }
          } else if (window.category === 'individual') {
               const existingIndividual = await this.findByEmployeeId(tenantId, window.employeeid);
               if (existingIndividual) {
                    await this.update(tenantId, existingIndividual.id!, window);
                    return existingIndividual.id!;
               }
          }

          if (window.category === 'global') {
               await connection.raw('SET FOREIGN_KEY_CHECKS = 0');
               try {
                    const [id] = await connection(this.TABLE_NAME).insert(window);
                    return id;
               } finally {
                    await connection.raw('SET FOREIGN_KEY_CHECKS = 1');
               }
          } else {
               const [id] = await connection(this.TABLE_NAME).insert(window);
               return id;
          }
     }

     static async findById(tenantId: number, id: number): Promise<AccessWindow | undefined> {
          const connection = await KnexConnection(tenantId);
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

     static async findByEmployeeId(tenantId: number, employeeid: number): Promise<AccessWindow | undefined> {
          const connection = await KnexConnection(tenantId);
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
     }

     static async update(tenantId: number, id: number, updates: Partial<AccessWindow>): Promise<boolean> {
          const connection = await KnexConnection(tenantId);
          const updated = await connection(this.TABLE_NAME).where({ id }).update(updates);
          return updated > 0;
     }

     static async delete(tenantId: number, id: number): Promise<boolean> {
          const connection = await KnexConnection(tenantId);
          const deleted = await connection(this.TABLE_NAME).where({ id }).del();
          return deleted > 0;
     }

     static async deleteByEmployeeId(tenantId: number, employeeid: number): Promise<boolean> {
          const connection = await KnexConnection(tenantId);
          const deleted = await connection(this.TABLE_NAME).where({ employeeid, category: 'individual' }).del();
          return deleted > 0;
     }

     static async findGlobalSettings(tenantId: number): Promise<AccessWindow | undefined> {
          const connection = await KnexConnection(tenantId);
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

     static async getEffectiveSettings(tenantId: number, employeeid: number): Promise<AccessWindow | undefined> {
          const employeeSettings = await this.findByEmployeeId(tenantId, employeeid);
          if (employeeSettings) {
               return employeeSettings;
          }
          // Fall back to global settings
          return await this.findGlobalSettings(tenantId);
     }
}