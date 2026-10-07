import * as departmentQueries from "./departmentQueries";
import ApplicationSettings from "../application/appsettings/appset";
import { rowAffected, promisifyQuery } from "../../hooks/helper";
import { testPanelCache } from "../../services/cache/testPanelCache";

export type newDepartment = {
    department: string;
    departmentManager: string;
    employeeid: number;
    id?: number;
};

export class DepartmentLims extends ApplicationSettings {
    departmentId: number | null;
    constructor(departmentId: number) {
        super();
        this.departmentId = departmentId;
    }

    public async addNewDepartment(tenantId: number, requestBody: newDepartment): Promise<boolean> {
        const { department, departmentManager, employeeid } = requestBody;
        const values = [department, departmentManager, employeeid];
        const inserted = rowAffected(await promisifyQuery(tenantId, departmentQueries.INSERT_DEPARTMENT, values));
        if (inserted) await testPanelCache.invalidate(tenantId);
        return inserted;
    }

    public getDepartments(tenantId: number): Promise<newDepartment[]> {
        return promisifyQuery(tenantId, departmentQueries.SELECT_ALL_DEPARTMENTS);
    }

    public async updateDepartment(tenantId: number, requestBody: newDepartment): Promise<boolean> {
        const { department, departmentManager, id, employeeid } = requestBody;
        const values = [department, departmentManager, employeeid, parseInt(id!.toString())];
        const updated = rowAffected(await promisifyQuery(tenantId, departmentQueries.UPDATE_DEPARTMENT, values));
        if (updated) await testPanelCache.invalidate(tenantId);
        return updated;
    }

    public async deleteDepartment(tenantId: number): Promise<boolean> {
        if (this.departmentId) {
            const values = [this.departmentId];
            const packet = await promisifyQuery(tenantId, departmentQueries.DELETE_DEPARTMENT, values);
            const deleted = rowAffected(packet);
            if (deleted) await testPanelCache.invalidate(tenantId);
            return deleted;
        }
        return false;
    }

    public async getSpecificDepartment(tenantId: number): Promise<newDepartment | null> {
        const values = [this.departmentId];
        const dataPackets = await promisifyQuery(tenantId, departmentQueries.SELECT_DEPARTMENT_BY_ID, values);
        return dataPackets.length > 0 ? dataPackets[0] : null;
    }
}
