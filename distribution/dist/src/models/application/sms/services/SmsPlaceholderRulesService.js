"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsPlaceholderRulesService = void 0;
function mapPlaceholderRuleDtoToDb(dto) {
    return {
        category: dto.category,
        placeholder: dto.placeholder,
        columnname: dto.columnName,
        tablename: dto.tableName,
        description: dto.description,
    };
}
class SmsPlaceholderRulesService {
    constructor(rulesRepo) {
        this.rulesRepo = rulesRepo;
    }
    async createRule(dto) {
        return this.rulesRepo.create(mapPlaceholderRuleDtoToDb(dto));
    }
    async getRuleById(id) {
        return this.rulesRepo.findById(id);
    }
    async updateRule(id, dto) {
        return this.rulesRepo.update(id, mapPlaceholderRuleDtoToDb(dto));
    }
    async deleteRule(id) {
        return this.rulesRepo.delete(id);
    }
    async getAllRules() {
        return this.rulesRepo.findAll();
    }
}
exports.SmsPlaceholderRulesService = SmsPlaceholderRulesService;
