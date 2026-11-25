import { PrimeLimsTableexpensesrecord_audit_log } from "../../interfaces/database";
import KnexConnection from "../../database/KnexConnections";
import { TiifuWorkingClass } from "../../database/TiifuWorkingClass";

export default class ExpenseAuditLog {
     private expenseId: number;
     private tenantId: number;
     private connection: any;
     private tablename: string;

     constructor(tenantId: number, expenseid: number) {
          this.expenseId = expenseid;
          this.tenantId = tenantId;
          this.connection = KnexConnection(tenantId);
          this.tablename = `expensesrecord_audit_log`;
     }



     async getExpenseAuditLogInformation() {
          try {
               const conn = await this.connection;
               const result: PrimeLimsTableexpensesrecord_audit_log[] = await conn(this.tablename)
                    .leftJoin('roles', 'roles.employeeid', `expensesrecord_audit_log.changed_by`)
                    .select("expensesrecord_audit_log.*", 'roles.username')
                    .where({ record_id: this.expenseId });
               if (result && Array.isArray(result) && result.length > 0) {
                    const pResult = result.map((item: PrimeLimsTableexpensesrecord_audit_log, index: number) => {
                         if (TiifuWorkingClass.isJson(item.old_data)) {
                              item.old_data = JSON.parse(item.old_data);
                         }

                         if (TiifuWorkingClass.isJson(item.new_data)) {
                              item.new_data = JSON.parse(item.new_data);
                         }
                         delete item.table_name;
                         return item;
                    })
                    return pResult;
               }
               return []
          } catch (err) {
               console.log(err)
          }
     }


}