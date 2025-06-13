import { z } from "zod";
import KnexConnection from "../../../../database/KnexConnections";

export interface Event {
     id?: number;
     name: string;
     attachedscheduler: number;
     messageheader?: string;
     activated?: boolean;
}

const EventSchema = z.object({
     id: z.number().optional(),
     name: z.string().min(1),
     attachedscheduler: z.number(),
     messageheader: z.string().optional(),
     activated: z.boolean().optional(),
});

export class EventsRepository {
     private tenantId: number
     private tablename: string
     private connection
     constructor(tenantId: number) {
          this.tenantId = tenantId;
          this.tablename = "smsevents"
          this.connection = KnexConnection(tenantId);
     }

     async create(event: Event): Promise<number> {
          EventSchema.parse(event);
          const conn = await this.connection;
          const [id] = await conn(this.tablename).insert(event).returning("id");
          return typeof id === "object" ? id.id : id;
     }

     async findById(id: number): Promise<Event | undefined> {
          const conn = await this.connection
          return await conn(this.tablename).where({ id }).first();
     }

     async findAll(): Promise<Event[]> {
          const conn = await this.connection
          return await conn(this.tablename).select("*");
     }

     async update(id: number, updates: Partial<Event>): Promise<number> {
          EventSchema.partial().parse(updates);
          const conn = await this.connection
          return await conn(this.tablename).where({ id }).update(updates);
     }

     async delete(id: number): Promise<number> {
          const conn = await this.connection
          return await conn(this.tablename).where({ id }).del();
     }

     async updateByName(name: string, event: Event): Promise<number> {
          const conn = await this.connection
          const result = await conn(this.tablename)
               .where("name", name)
               .update({
                    attachedscheduler: event.attachedscheduler,
                    messageheader: event.messageheader,
                    activated: event.activated,
               });
          return result;
     }

     async findByName(name: string): Promise<Event | undefined> {
          const conn = await this.connection;
          return await conn(this.tablename)
               .where("name", name)
               .first();
     }


     async isEventValid(eventname: Event['name']): Promise<boolean> {
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