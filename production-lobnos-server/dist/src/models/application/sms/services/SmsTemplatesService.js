"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsTemplatesService = void 0;
function mapTemplateDtoToDb(dto) {
    return {
        name: dto.name,
        body: dto.body,
        category: dto.category,
        createdby: dto.createdBy,
    };
}
class SmsTemplatesService {
    constructor(templatesRepo) {
        this.templatesRepo = templatesRepo;
    }
    async createTemplate(dto) {
        return this.templatesRepo.create(mapTemplateDtoToDb(dto));
    }
    async getTemplateById(id) {
        return this.templatesRepo.findById(id);
    }
    async updateTemplate(id, dto) {
        return this.templatesRepo.update(id, mapTemplateDtoToDb(dto));
    }
    async deleteTemplate(id) {
        return this.templatesRepo.delete(id);
    }
    async getAllTemplates() {
        return this.templatesRepo.findAll();
    }
    async getAllTemplatesPaginated(page, count) {
        return this.templatesRepo.findAllPaginated(page, count);
    }
}
exports.SmsTemplatesService = SmsTemplatesService;
