import {
	q_get_drugs,
	q_insert_drug_sql,
	q_update_drug_sql,
	q_check_drug_exists,
	q_delete_drug_sql,
	q_get_drugs_category,
	q_insert_drug_category_sql,
	q_update_drug_category_sql,
	q_check_drug_category_exists,
	q_delete_drug_category_sql
} from "./queries";
import User from "../../LobnosAuth/user";
import { drugCategoryInformation, DrugInfo } from "./types";
import { OperationsFailures } from '../operations/types';
import { promisifyQuery, rowAffected } from "../../hooks/helper";

export class DrugManagementService {
	private async hasDrug(tenantId: number, drugName: string, category: string): Promise<boolean> {
		const result = await promisifyQuery(tenantId, q_check_drug_exists, [drugName, category]);
		return result.length > 0;
	}

	public async addNewDrug(tenantId: number, drugInformation: { drug: string; addedOn: string|Date; category: string; createdBy: string }): Promise<boolean | string> {
		const { drug, addedOn, category, createdBy } = drugInformation;

		if (await this.hasDrug(tenantId, drug, category)) return "Drug already exists in this category";

		const result = await promisifyQuery(tenantId, q_insert_drug_sql, [drug, addedOn, category, createdBy]);
		return rowAffected(result);
	}

	public async updateDrug(tenantId: number, drugInformation: { id: number; drug: string; addedOn: string; category: string; createdBy: string }): Promise<boolean | string> {
		const { id, drug, category, createdBy } = drugInformation;

		const result = await promisifyQuery(tenantId, q_update_drug_sql, [drug, new Date(), category, createdBy, id]);
		return rowAffected(result);
	}

	private async hasPermissionToDelete(tenantId: number, id: number) {
		const user = new User(null, null, null, null, null);
		let userData = await user.getUserDataById(id, tenantId);
		if (userData.length == 0) return false;
		const { role } = userData[0];
		if (role && ['manager', 'admin'].includes(role.toLowerCase())) return true;
		return false;
	}

	public async deleteDrug(tenantId: number, id: number, employeeid: number): Promise<boolean | string> {
		const hasPermission = await this.hasPermissionToDelete(tenantId, employeeid);
		if (hasPermission) {
			const result = await promisifyQuery(tenantId, q_delete_drug_sql, [id]);
			return rowAffected(result);
		}
		return OperationsFailures.dontHavePermission;
	}

	public async getDrugs(tenantId: number): Promise<any[]> {
		return await promisifyQuery(tenantId, q_get_drugs);
	}

	private async hasDrugCategory(tenantId: number, categoryName: string): Promise<boolean> {
		const result = await promisifyQuery(tenantId, q_check_drug_category_exists, [categoryName]);
		return result.length > 0;
	}

	public async addNewDrugCategory(tenantId: number, drugCategoryInformation: drugCategoryInformation): Promise<boolean | string> {
		const { categoryName, description, createdBy } = drugCategoryInformation;

		if (await this.hasDrugCategory(tenantId, categoryName)) return DrugInfo.catExist;

		const result = await promisifyQuery(tenantId, q_insert_drug_category_sql, [categoryName, description, createdBy]);
		return rowAffected(result);
	}

	public async updateDrugCategory(tenantId: number, drugCategoryInformation: drugCategoryInformation & { id: number }): Promise<boolean | string> {
		const { id, categoryName, description, createdBy } = drugCategoryInformation;

		const result = await promisifyQuery(tenantId, q_update_drug_category_sql, [categoryName, description, createdBy, id]);
		return rowAffected(result);
	}

	public async deleteDrugCategory(tenantId: number, id: number): Promise<boolean> {
		const result = await promisifyQuery(tenantId, q_delete_drug_category_sql, [id]);
		return rowAffected(result);
	}

	public async getDrugsCategory(tenantId: number): Promise<any[]> {
		let result = await promisifyQuery(tenantId, q_get_drugs_category);
		if (result.length > 0) {
			const user = new User(null, null, null, null, null);
			result = await Promise.all(
				result.map(async (singleton: any) => {
					const userData = await user.getUserDataById(parseInt(singleton.createdBy), tenantId);
					if (userData.length === 0) return singleton;
					const { username } = userData[0];
					return { ...singleton, createdBy: username }
				})
			)
		}
		return result;
	}
}
