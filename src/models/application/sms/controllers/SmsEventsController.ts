import { Request, Response } from 'express';
import { CreateSmsEventSchema } from '../dtos/CreateSmsEventDto';
import { SmsEventsService } from '../services/SmsEventsService';

export class SmsEventsController {
     constructor(private eventsService: SmsEventsService) { }

     async create(req: Request, res: Response) {
          try {
               const dto = CreateSmsEventSchema.parse(req.body);
               const id = await this.eventsService.createEvent(dto);
               res.status(201).json({ id });
          } catch (err) {
               res.status(400).json({ error: err });
          }
     }

     async getById(req: Request, res: Response) {
          const event = await this.eventsService.getEventById(Number(req.params.id));
          if (!event) return res.status(404).json({ error: 'Not found' });
          res.json(event);
     }

     async update(req: Request, res: Response) {
          try {
               const partialSchema = CreateSmsEventSchema.partial();
               const dto = partialSchema.parse(req.body);
               const updated = await this.eventsService.updateEvent(Number(req.params.id), dto);
               res.json({ updated });
          } catch (err) {
               res.status(400).json({ error: err });
          }
     }

     async delete(req: Request, res: Response) {
          const deleted = await this.eventsService.deleteEvent(Number(req.params.id));
          res.json({ deleted });
     }

     async getAll(req: Request, res: Response) {
          const events = await this.eventsService.getAllEvents();
          res.json(events);
     }
}
