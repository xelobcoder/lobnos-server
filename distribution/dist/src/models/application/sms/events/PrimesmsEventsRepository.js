"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrimesmsEventsRepository = void 0;
const KnexConnections_1 = __importDefault(require("../../../../database/KnexConnections"));
const EventsRepository_1 = require("./EventsRepository");
class PrimesmsEventsRepository {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.tablename = 'primesmsevents';
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async findByCode(code) {
        const conn = await this.connection;
        const row = await conn(this.tablename).where({ code }).first();
        if (!row)
            return undefined;
        let placeholders = [];
        if (row.placeholders) {
            try {
                placeholders = JSON.parse(row.placeholders);
            }
            catch (e) {
                placeholders = [];
            }
        }
        return {
            eventid: row.eventid,
            code: row.code,
            description: row.description,
            category: row.category,
            content: row.content,
            active: row.active,
            createdat: row.createdat,
            placeholders
        };
    }
    async setActiveByCode(code, active) {
        const conn = await this.connection;
        await conn(this.tablename).where({ code }).update({ active });
    }
    async updateContentByCode(code, content) {
        const conn = await this.connection;
        let newContent = content && content.trim() ? content : undefined;
        if (!newContent) {
            const def = EventsRepository_1.EVENTS.find(e => e.code === code);
            if (def)
                newContent = def.defaultContent;
        }
        if (newContent) {
            await conn(this.tablename).where({ code }).update({ content: newContent });
        }
    }
    async findById(eventid) {
        return (await this.connection)(this.tablename).where({ eventid: Number(eventid) }).first();
    }
    async getEffectiveTemplate(code) {
        const dbEvent = await this.findByCode(code);
        if (dbEvent && dbEvent.content && dbEvent.content.trim())
            return dbEvent.content;
        const def = EventsRepository_1.EVENTS.find(e => e.code === code);
        return def === null || def === void 0 ? void 0 : def.defaultContent;
    }
    async getAll() {
        const conn = await this.connection;
        let events = await conn(this.tablename).select('*');
        if (!events || events.length === 0) {
            const toInsert = EventsRepository_1.EVENTS.map(e => ({
                code: e.code,
                description: e.description,
                category: e.category,
                content: e.defaultContent,
                active: true,
                placeholders: JSON.stringify(e.placeholders)
            }));
            await conn(this.tablename).insert(toInsert);
            events = await conn(this.tablename).select('*');
        }
        // Parse placeholders for all events
        return events.map(row => {
            let placeholders = [];
            if (row.placeholders) {
                try {
                    placeholders = JSON.parse(row.placeholders);
                }
                catch (e) {
                    placeholders = [];
                }
            }
            return {
                eventid: row.eventid,
                code: row.code,
                description: row.description,
                category: row.category,
                content: row.content,
                active: row.active,
                createdat: row.createdat,
                placeholders
            };
        });
    }
    async updateTemplate(code, content) {
        const conn = await this.connection;
        const result = await conn(this.tablename).where({ code }).update({ content });
        return result > 0;
    }
    async updateActiveStatus(eventid, active) {
        const conn = await this.connection;
        return await conn(this.tablename).where({ eventid: Number(eventid) }).update({ active });
    }
}
exports.PrimesmsEventsRepository = PrimesmsEventsRepository;
