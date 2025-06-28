import { PrimeSmsEventsRepo } from '../repositories/PrimeSmsEventsRepo';
import { CreateSmsEventDto } from '../dtos/CreateSmsEventDto';

function mapEventDtoToDb(dto: any) {
     return {
          code: dto.code,
          description: dto.description,
          category: dto.category,
     };
}

export class SmsEventsService {
     constructor(private eventsRepo: PrimeSmsEventsRepo) { }

     async createEvent(dto: CreateSmsEventDto) {
          return this.eventsRepo.create(mapEventDtoToDb(dto));
     }

     async getEventById(id: number) {
          return this.eventsRepo.findById(id);
     }

     async updateEvent(id: number, dto: Partial<CreateSmsEventDto>) {
          return this.eventsRepo.update(id, mapEventDtoToDb(dto));
     }

     async deleteEvent(id: number) {
          return this.eventsRepo.delete(id);
     }

     async getAllEvents() {
          return this.eventsRepo.findAll();
     }
}
