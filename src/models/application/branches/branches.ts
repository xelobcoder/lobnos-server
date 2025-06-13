
import { rowAffected, promisifyQuery, paginationQuery } from "../../../hooks/helper";
import ApplicationSettings from "../appsettings/appset";
import { g_get_branch, q_add_new_branch, q_branches_delete_single, q_branches_get_all, q_branches_get_single, q_branches_update_single, q_update_activation } from "./queries";

class Branch extends ApplicationSettings {
     static async addBranch(tenantId: number, name: string, address: string, email: string, contact: string, managerid: number): Promise<boolean> {
          return rowAffected(await promisifyQuery(tenantId, q_add_new_branch, [name, address, email, contact, managerid]));
     }

     static async getBranch(tenantId: number, count = 10, page = 1, branchid?: number) {
          if (branchid) {
               return await promisifyQuery(tenantId, q_branches_get_all, [branchid]);
          }
          return await paginationQuery({ count, page }, q_branches_get_single, [], tenantId);
     }

     static async editBranch(tenantId: number, branchid: number, name: string, contact: string, address: string, email: string, managerid: number) {
          return await promisifyQuery(tenantId, q_branches_update_single, [name, contact, address, email, managerid, branchid]);
     }

     static async deleteBranch(tenantId: number, branchid: string | number) {
          return await promisifyQuery(tenantId, q_branches_delete_single, [branchid]);
     }

     static async activateDeactivateBranch(tenantId: number, id: number, status: boolean) {
          return await promisifyQuery(tenantId, q_update_activation, [id, `${status}`]);
     }

     static async find(tenantId: number, branchid: number) {
          const result = await promisifyQuery(tenantId, g_get_branch, [branchid]);
          return Array.isArray(result) && result.length > 0 ? result[0] : undefined
     }
}

export default Branch;
