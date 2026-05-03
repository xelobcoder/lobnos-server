"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DrugManagementService = void 0;
const queries_1 = require("./queries");
const user_1 = __importDefault(require("../../LobnosAuth/user"));
const helper_1 = require("../../hooks/helper");
class DrugManagementService {
    async hasDrug(tenantId, drugName, category) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_check_drug_exists, [drugName, category]);
        return result.length > 0;
    }
    async addNewDrug(tenantId, drugInformation) {
        const { drug, addedOn, category, createdBy } = drugInformation;
        if (await this.hasDrug(tenantId, drug, category))
            return "Drug already exists in this category";
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_insert_drug_sql, [drug, addedOn, category, createdBy]);
        return (0, helper_1.rowAffected)(result);
    }
    async updateDrug(tenantId, drugInformation) {
        const { id, drug, category, createdBy } = drugInformation;
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_update_drug_sql, [drug, new Date(), category, createdBy, id]);
        return (0, helper_1.rowAffected)(result);
    }
    async hasPermissionToDelete(tenantId, id) {
        const user = new user_1.default(null, null, null, null, null);
        let userData = await user.getUserDataById(id, tenantId);
        if (userData.length == 0)
            return false;
        const { role } = userData[0];
        if (role && ['manager', 'admin'].includes(role.toLowerCase()))
            return true;
        return false;
    }
    async deleteDrug(tenantId, id, employeeid) {
        const hasPermission = await this.hasPermissionToDelete(tenantId, employeeid);
        if (hasPermission) {
            const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_delete_drug_sql, [id]);
            return (0, helper_1.rowAffected)(result);
        }
        return "You do not have permission to delete this resources" /* OperationsFailures.dontHavePermission */;
    }
    async getDrugs(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_get_drugs);
    }
    async hasDrugCategory(tenantId, categoryName) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_check_drug_category_exists, [categoryName]);
        return result.length > 0;
    }
    async addNewDrugCategory(tenantId, drugCategoryInformation) {
        const { categoryName, description, createdBy } = drugCategoryInformation;
        if (await this.hasDrugCategory(tenantId, categoryName))
            return "Drug Category Already Exist" /* DrugInfo.catExist */;
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_insert_drug_category_sql, [categoryName, description, createdBy]);
        return (0, helper_1.rowAffected)(result);
    }
    async updateDrugCategory(tenantId, drugCategoryInformation) {
        const { id, categoryName, description, createdBy } = drugCategoryInformation;
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_update_drug_category_sql, [categoryName, description, createdBy, id]);
        return (0, helper_1.rowAffected)(result);
    }
    async deleteDrugCategory(tenantId, id) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_delete_drug_category_sql, [id]);
        return (0, helper_1.rowAffected)(result);
    }
    async getDrugsCategory(tenantId) {
        let result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_get_drugs_category);
        if (result.length > 0) {
            const user = new user_1.default(null, null, null, null, null);
            result = await Promise.all(result.map(async (singleton) => {
                const userData = await user.getUserDataById(parseInt(singleton.createdBy), tenantId);
                if (userData.length === 0)
                    return singleton;
                const { username } = userData[0];
                return Object.assign(Object.assign({}, singleton), { createdBy: username });
            }));
        }
        return result;
    }
}
exports.DrugManagementService = DrugManagementService;
