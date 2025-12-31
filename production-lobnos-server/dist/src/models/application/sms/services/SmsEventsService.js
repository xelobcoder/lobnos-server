"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsEventsService = void 0;
function mapEventDtoToDb(dto) {
    return {
        code: dto.code,
        description: dto.description,
        category: dto.category,
    };
}
class SmsEventsService {
    constructor(eventsRepo) {
        this.eventsRepo = eventsRepo;
    }
    async createEvent(dto) {
        return this.eventsRepo.create(mapEventDtoToDb(dto));
    }
    async getEventById(id) {
        return this.eventsRepo.findById(id);
    }
    async updateEvent(id, dto) {
        return this.eventsRepo.update(id, mapEventDtoToDb(dto));
    }
    async deleteEvent(id) {
        return this.eventsRepo.delete(id);
    }
    async getAllEvents() {
        return this.eventsRepo.findAll();
    }
}
exports.SmsEventsService = SmsEventsService;
