import { Request, Response } from "express";
import { EventsRepository } from "../../models/application/sms/events/EventsRepository";

export interface SmsEvent {
    id?: number;
    name: string;
    attachedscheduler: number;
    messageheader?: string;
    activated?: boolean;
}



interface EventsPayload {
    events: SmsEvent[];
}

export const createEvent = async (req: Request, res: Response) => {
    try {
        const tenantId = parseInt(req.query.tenantId as string);
        const { events } = req.body as EventsPayload;
        
        if (!Array.isArray(events)) {
            return res.status(400).json({ error: "Events must be an array" });
        }

        const eventsRepo = new EventsRepository(tenantId);
        const existingEvents = await eventsRepo.findAll();
        
        const newEvents = events.filter(event => 
            !existingEvents.some(existing => 
                existing.name === event.name
            )
        );

        const updatedEvents = events.filter(event =>
            existingEvents.some(existing => 
                existing.name === event.name &&
                (existing.attachedscheduler !== event.attachedscheduler ||
                 existing.messageheader !== event.messageheader ||
                 existing.activated !== event.activated)
            )
        );

        const results = {
            created: await Promise.all(newEvents.map(event => eventsRepo.create(event))),
            updated: await Promise.all(updatedEvents.map(event => 
                eventsRepo.updateByName(event.name, event)
            ))
        };

        res.status(200).json({ 
            success: true,
            message: `${results.created.length} events created, ${results.updated.length} events updated`,
            results
        });
    } catch (err: any) {
        res.status(400).json({ 
            success: false,
            error: err.message 
        });
    }
};

export const getEventById = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = parseInt(req.query.tenantId as string);
        const id = parseInt(req.params.id);
        const event = await new EventsRepository(tenantId).findById(id);
        if (!event) {
            res.status(404).json({ error: "Event not found" });
        } else {
            res.json(event);
        }
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
};

export const getAllEvents = async (req: Request, res: Response) => {
    try {
        const tenantId = parseInt(req.query.tenantId as string);
        const events = await new EventsRepository(tenantId).findAll();
        res.json(events);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
};

export const updateEvent = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = parseInt(req.query.tenantId as string);
        const id = parseInt(req.params.id);
        const updates = req.body;
        const updated = await new EventsRepository(tenantId).update(id, updates);
        if (updated === 0) {
            res.status(404).json({ error: "Event not found or not updated" });
        } else {
            res.json({ updated });
        }
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
};

export const deleteEvent = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = parseInt(req.query.tenantId as string);
        const id = parseInt(req.params.id);
        const deleted = await new EventsRepository(tenantId).delete(id);
        if (deleted === 0) {
            res.status(404).json({ error: "Event not found or not deleted" });
        }
        else {
            res.json({ deleted });
        }
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
};