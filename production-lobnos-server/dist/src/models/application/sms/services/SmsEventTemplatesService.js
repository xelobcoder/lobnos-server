"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsEventTemplatesService = void 0;
function mapEventTemplateDtoToDb(dto) {
    return {
        eventid: dto.eventId,
        templateid: dto.templateId,
        isactive: dto.isActive,
    };
}
class SmsEventTemplatesService {
    constructor(eventTemplatesRepo) {
        this.eventTemplatesRepo = eventTemplatesRepo;
    }
    async createEventTemplate(dto) {
        return this.eventTemplatesRepo.create(mapEventTemplateDtoToDb(dto));
    }
    async getEventTemplateById(id) {
        return this.eventTemplatesRepo.findById(id);
    }
    async updateEventTemplate(id, dto) {
        return this.eventTemplatesRepo.update(id, mapEventTemplateDtoToDb(dto));
    }
    async deleteEventTemplate(id) {
        return this.eventTemplatesRepo.delete(id);
    }
    async getAllByEvent(eventId) {
        return this.eventTemplatesRepo.findAllByEvent(eventId);
    }
    async getAllByTemplate(templateId) {
        return this.eventTemplatesRepo.findAllByTemplate(templateId);
    }
}
exports.SmsEventTemplatesService = SmsEventTemplatesService;
