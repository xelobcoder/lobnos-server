"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventsRepository = void 0;
const zod_1 = require("zod");
const KnexConnections_1 = __importDefault(require("../../../../database/KnexConnections"));
const EventSchema = zod_1.z.object({
    id: zod_1.z.number().optional(),
    name: zod_1.z.string().min(1),
    attachedscheduler: zod_1.z.number(),
    messageheader: zod_1.z.string().optional(),
    activated: zod_1.z.boolean().optional(),
});
class EventsRepository {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.tablename = "smsevents";
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async create(event) {
        EventSchema.parse(event);
        const conn = await this.connection;
        const [id] = await conn(this.tablename).insert(event).returning("id");
        return typeof id === "object" ? id.id : id;
    }
    async findById(id) {
        const conn = await this.connection;
        return await conn(this.tablename).where({ id }).first();
    }
    async findAll() {
        const conn = await this.connection;
        return await conn(this.tablename).select("*");
    }
    async update(id, updates) {
        EventSchema.partial().parse(updates);
        const conn = await this.connection;
        return await conn(this.tablename).where({ id }).update(updates);
    }
    async delete(id) {
        const conn = await this.connection;
        return await conn(this.tablename).where({ id }).del();
    }
    async updateByName(name, event) {
        const conn = await this.connection;
        const result = await conn(this.tablename)
            .where("name", name)
            .update({
            attachedscheduler: event.attachedscheduler,
            messageheader: event.messageheader,
            activated: event.activated,
        });
        return result;
    }
    async findByName(name) {
        const conn = await this.connection;
        return await conn(this.tablename)
            .where("name", name)
            .first();
    }
    async isEventValid(eventname) {
        const event = await this.findByName(eventname);
        if (!event) {
            return false;
        }
        if (!event.attachedscheduler || !event.messageheader) {
            return false;
        }
        return true;
    }
}
exports.EventsRepository = EventsRepository;
