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
import { roleAllowed } from "../../middleware/roles";
import KnexConnection from "../../database/KnexConnections";

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

	public async addMultipleDrugs(
		tenantId: number,
		drugEntries: unknown,
		createdBy: unknown,
	): Promise<number | string> {
		if (!Array.isArray(drugEntries) || drugEntries.length < 1 || drugEntries.length > 100) {
			return "Submit between 1 and 100 drugs";
		}
		const employeeId = Number(createdBy);
		if (!Number.isSafeInteger(employeeId) || employeeId < 1) return "A valid creator is required";

		const drugs: Array<{ drug: string; category: number }> = [];
		const submitted = new Set<string>();
		for (const entry of drugEntries) {
			if (!entry || typeof entry !== "object" || Array.isArray(entry)) return "Enter valid drug details";
			const item = entry as Record<string, unknown>;
			const name = typeof item.drug === "string" ? item.drug.trim().replace(/\s+/g, " ") : "";
			const categoryId = Number(item.category);
			if (!name || name.length > 255) return "Drug names must contain 1 to 255 characters";
			if (!Number.isSafeInteger(categoryId) || categoryId < 1) return "Choose a valid drug category for every drug";
			const key = `${categoryId}:${name.toLowerCase()}`;
			if (submitted.has(key)) return `Duplicate drug name in this request: ${name}`;
			submitted.add(key);
			drugs.push({ drug: name, category: categoryId });
		}

		const connection = await KnexConnection(tenantId);
		return connection.transaction(async (trx) => {
			const categoryIds = [...new Set(drugs.map((entry) => entry.category))];
			const categories = await trx("drugscategory").whereIn("id", categoryIds).select("id");
			if (categories.length !== categoryIds.length) return "Choose a valid drug category for every drug";

			const existingRows = await trx("drugs").whereIn("category", categoryIds).select("drug", "category");
			const existing = new Set(existingRows.map((row) =>
				`${Number(row.category)}:${String(row.drug).trim().replace(/\s+/g, " ").toLowerCase()}`));
			const duplicate = drugs.find((entry) => existing.has(`${entry.category}:${entry.drug.toLowerCase()}`));
			if (duplicate) return `Drug already exists in this category: ${duplicate}`;

			for (const entry of drugs) {
				await trx("drugs").insert({
					drug: entry.drug,
					addedOn: new Date(),
					category: entry.category,
					createdby: employeeId,
				});
			}
			return drugs.length;
		});
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
		if (roleAllowed(role, ['manager', 'admin'])) return true;
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
