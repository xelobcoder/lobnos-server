
import { rowAffected, promisifyQuery, paginationQuery } from "../../../hooks/helper";
import ApplicationSettings from "../appsettings/appset";
import { g_get_branch, q_add_new_branch, q_branches_delete_single, q_branches_get_all, q_branches_get_single, q_branches_update_single, q_update_activation } from "./queries";
import { branchCache } from "../../../services/cache/testPanelCache";

class Branch extends ApplicationSettings {
     static async addBranch(tenantId: number, name: string, address: string, email: string, contact: string, managerid: number): Promise<boolean> {
          const added = rowAffected(await promisifyQuery(tenantId, q_add_new_branch, [name, address, email, contact, managerid]));
          if (added) await branchCache.invalidate(tenantId);
          return added;
     }

     static async getBranch(tenantId: number, count = 10, page = 1, branchid?: number) {
          if (branchid) {
               return branchCache.getOrLoad(tenantId, 'branch-by-id', { branchid },
                    () => promisifyQuery(tenantId, q_branches_get_all, [branchid]));
          }
          const pageSize = parseInt(String(count || 10));
          const currentPage = parseInt(String(page || 1));
          return branchCache.getOrLoad(tenantId, 'branch-list', { count: pageSize, page: currentPage },
               () => paginationQuery({ count, page }, q_branches_get_single, [], tenantId));
     }

     static async editBranch(tenantId: number, branchid: number, name: string, contact: string, address: string, email: string, managerid: number) {
          const updated = rowAffected(await promisifyQuery(tenantId, q_branches_update_single, [name, contact, address, email, managerid, branchid]));
          if (updated) await branchCache.invalidate(tenantId);
          return updated;
     }

     static async deleteBranch(tenantId: number, branchid: string | number) {
         const result = await promisifyQuery(tenantId, q_branches_delete_single, [branchid]);
         const deleted = rowAffected(result);
         if (deleted) await branchCache.invalidate(tenantId);
         return deleted;
     }

     static async activateDeactivateBranch(tenantId: number, id: number, status: number) {
          const result = await promisifyQuery(tenantId, q_update_activation, [status, id]);
          const updated = rowAffected(result);
          if (updated) await branchCache.invalidate(tenantId);
          return updated;
     }

     static async find(tenantId: number, branchid: number) {
          const result = await promisifyQuery(tenantId, g_get_branch, [branchid]);
          return Array.isArray(result) && result.length > 0 ? result[0] : undefined
     }
}

export default Branch;
