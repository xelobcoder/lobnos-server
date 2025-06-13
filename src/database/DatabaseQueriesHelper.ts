import { promisifyQuery, rowAffected } from "../hooks/helper";
import {
     q_check_duplicate,
     q_delete_single,
     q_delete_many,
     q_get_all,
     q_get_single_role,
     q_new_role,
     q_update_role,
     q_delete_role,
     q_truncate_table
} from "./queries";
import { TiifuWorkingClass } from "./TiifuWorkingClass";

interface DatabaseQueries {
     checkDuplicate: (
          tenantId: number,
          type: string,
          table: string,
          id: number,
          columnName: string,
          date: string
     ) => Promise<boolean>;
     del: (tenantId: number, id: number, table: string, idResolver: string) => Promise<any>;
     deleteMany: (tenantId: number, deleteArray: number[], table: string) => Promise<any>;
     getAll: (tenantId: number, table: string, limit: number) => Promise<any>;
     getAllRoles: (tenantId: number) => Promise<any>;
     getSingleRole: (tenantId: number, id: number) => Promise<any>;
     newRole: (
          tenantId: number,
          fullname: string,
          username: string,
          password: string,
          role: string
     ) => Promise<any>;
     updateRole: (
          tenantId: number,
          fullname: string,
          username: string,
          role: string,
          password: string,
          roleid: number
     ) => Promise<any>;
     deleteWithID: (tenantId: number, id: number) => Promise<any>;
     deleteAllRows: (tenantId: number, tablename: string) => Promise<boolean>;
     getSingleId: (
          tenantId: number,
          id: number,
          table: string,
          idResolver: string
     ) => Promise<any>;
}

const databaseQueries: DatabaseQueries = {
     checkDuplicate: async (
          tenantId: number,
          type = "billingid",
          table: string,
          id: number,
          columnName: string,
          date = "testResults.getTodayDateAndTime().date"
     ) => {
          const result = await promisifyQuery(
               tenantId,
               q_check_duplicate(type, table, id, columnName, date),
               []
          );
          return result.length > 0;
     },

     del: async (tenantId: number, id: number, table: string, idResolver: string) => {
          const result = await promisifyQuery(tenantId, q_delete_single(id, table, idResolver), []);
          return result;
     },

     deleteMany: async (tenantId: number, deleteArray: number[], table: string) => {
          const result = await promisifyQuery(tenantId, q_delete_many(deleteArray, table), []);
          return result;
     },

     getAll: async (tenantId: number, table: string, limit: number) => {
          const result = await promisifyQuery(tenantId, q_get_all(table, limit), []);
          return result;
     },

     getAllRoles: async (tenantId: number) => {
          const result = await promisifyQuery(tenantId, q_get_all("roles", 100), []);
          return result;
     },

     getSingleRole: async (tenantId: number, id: number) => {
          const result = await promisifyQuery(tenantId, q_get_single_role(id), []);
          return result;
     },

     newRole: async (
          tenantId: number,
          fullname: string,
          username: string,
          password: string,
          role: string
     ) => {
          const values = [fullname, username, role, password];
          const result = await promisifyQuery(tenantId, q_new_role(fullname, username, password, role), values);
          return { message: `${fullname} added as a ${role}`, status: "success" };
     },

     updateRole: async (
          tenantId: number,
          fullname: string,
          username: string,
          role: string,
          password: string,
          roleid: number
     ) => {
          const result = await promisifyQuery(tenantId, q_update_role(fullname, username, role, password, roleid), []);
          return { message: "Information updated successfully", status: rowAffected(result) };
     },

     deleteWithID: async (tenantId: number, id: number) => {
          const result = await promisifyQuery(tenantId, q_delete_role(id), []);
          return { message: "Information deleted successfully", status: rowAffected(result)};
     },

     deleteAllRows: async (tenantId: number, tablename: string) => {
          const result = await promisifyQuery(tenantId, q_truncate_table(tablename), []);
          return result.fieldCount === 0;
     },

     getSingleId: async (tenantId: number, id: number, table: string, idResolver: string) => {
          const result = await new TiifuWorkingClass(table).findMany(tenantId, idResolver, id);
          return result;
     }
};

export default databaseQueries;
