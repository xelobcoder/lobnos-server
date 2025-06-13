"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteEvent = exports.updateEvent = exports.getAllEvents = exports.getEventById = exports.createEvent = void 0;
const EventsRepository_1 = require("../../models/application/sms/events/EventsRepository");
const createEvent = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const { events } = req.body;
        if (!Array.isArray(events)) {
            return res.status(400).json({ error: "Events must be an array" });
        }
        const eventsRepo = new EventsRepository_1.EventsRepository(tenantId);
        const existingEvents = await eventsRepo.findAll();
        const newEvents = events.filter(event => !existingEvents.some(existing => existing.name === event.name));
        const updatedEvents = events.filter(event => existingEvents.some(existing => existing.name === event.name &&
            (existing.attachedscheduler !== event.attachedscheduler ||
                existing.messageheader !== event.messageheader ||
                existing.activated !== event.activated)));
        const results = {
            created: await Promise.all(newEvents.map(event => eventsRepo.create(event))),
            updated: await Promise.all(updatedEvents.map(event => eventsRepo.updateByName(event.name, event)))
        };
        res.status(200).json({
            success: true,
            message: `${results.created.length} events created, ${results.updated.length} events updated`,
            results
        });
    }
    catch (err) {
        res.status(400).json({
            success: false,
            error: err.message
        });
    }
};
exports.createEvent = createEvent;
const getEventById = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const id = parseInt(req.params.id);
        const event = await new EventsRepository_1.EventsRepository(tenantId).findById(id);
        if (!event) {
            res.status(404).json({ error: "Event not found" });
        }
        else {
            res.json(event);
        }
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
};
exports.getEventById = getEventById;
const getAllEvents = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const events = await new EventsRepository_1.EventsRepository(tenantId).findAll();
        res.json(events);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
};
exports.getAllEvents = getAllEvents;
const updateEvent = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const id = parseInt(req.params.id);
        const updates = req.body;
        const updated = await new EventsRepository_1.EventsRepository(tenantId).update(id, updates);
        if (updated === 0) {
            res.status(404).json({ error: "Event not found or not updated" });
        }
        else {
            res.json({ updated });
        }
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
};
exports.updateEvent = updateEvent;
const deleteEvent = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const id = parseInt(req.params.id);
        const deleted = await new EventsRepository_1.EventsRepository(tenantId).delete(id);
        if (deleted === 0) {
            res.status(404).json({ error: "Event not found or not deleted" });
        }
        else {
            res.json({ deleted });
        }
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
};
exports.deleteEvent = deleteEvent;
