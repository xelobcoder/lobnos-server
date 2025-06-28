"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsCategoryMappingsService = void 0;
function mapCategoryMappingDtoToDb(dto) {
    return {
        category: dto.category,
        tablename: dto.tableName,
        idcolumn: dto.idColumn,
        phonecolumn: dto.phoneColumn,
        namecolumn: dto.nameColumn,
        additionalfields: dto.additionalFields,
    };
}
class SmsCategoryMappingsService {
    constructor(mappingsRepo) {
        this.mappingsRepo = mappingsRepo;
    }
    async createMapping(dto) {
        return this.mappingsRepo.create(mapCategoryMappingDtoToDb(dto));
    }
    async getMappingById(id) {
        return this.mappingsRepo.findById(id);
    }
    async updateMapping(id, dto) {
        return this.mappingsRepo.update(id, mapCategoryMappingDtoToDb(dto));
    }
    async deleteMapping(id) {
        return this.mappingsRepo.delete(id);
    }
    async getAllMappings() {
        return this.mappingsRepo.findAll();
    }
}
exports.SmsCategoryMappingsService = SmsCategoryMappingsService;
