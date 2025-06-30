



import KnexConnection from '../../../../database/KnexConnections';
import { EVENTS, Event } from './EventsRepository';

export interface PrimesmsEvent {
	eventid?: number;
	code: string;
	description?: string;
	category: 'patient' | 'clinician' | 'organization';
	content: string;
	active?: boolean;
	createdat?: Date | string;
}


export class PrimesmsEventsRepository {
	private tenantId: number;
	private tablename: string;
	private connection;
	constructor(tenantId: number) {
		this.tenantId = tenantId;
		this.tablename = 'primesmsevents';
		this.connection = KnexConnection(tenantId);
	}

	async findByCode(code: string): Promise<PrimesmsEvent | undefined> {
		const conn = await this.connection;
		return await conn(this.tablename).where({ code }).first();
	}

	async setActiveByCode(code: string, active: boolean): Promise<void> {
		const conn = await this.connection;
		await conn(this.tablename).where({ code }).update({ active });
	}


	async updateContentByCode(code: string, content: string): Promise<void> {
		const conn = await this.connection;
		let newContent = content && content.trim() ? content : undefined;
		if (!newContent) {
			const def = EVENTS.find(e => e.code === code);
			if (def) newContent = def.defaultContent;
		}
		if (newContent) {
			await conn(this.tablename).where({ code }).update({ content: newContent });
		}
	}

	async findById(eventid: number | string): Promise<PrimesmsEvent | undefined> {
		return (await this.connection)(this.tablename).where({ eventid: Number(eventid) }).first();
	}

	async getEffectiveTemplate(code: string): Promise<string | undefined> {
		const dbEvent = await this.findByCode(code);
		if (dbEvent && dbEvent.content && dbEvent.content.trim()) return dbEvent.content;
		const def = EVENTS.find(e => e.code === code);
		return def?.defaultContent;
	}


	async getAll(): Promise<PrimesmsEvent[]> {
		const conn = await this.connection;
		let events = await conn(this.tablename).select('*');
		if (!events || events.length === 0) {
			const toInsert = EVENTS.map(e => ({
				code: e.code,
				description: e.description,
				category: e.category,
				content: e.defaultContent,
				active: true
			}));
			await conn(this.tablename).insert(toInsert);
			events = await conn(this.tablename).select('*');
		}
		return events;
	}

	// Update the SMS template/content for an event
	async updateTemplate(code: string, content: string): Promise<boolean> {
		const conn = await this.connection;
		const result = await conn(this.tablename).where({ code }).update({ content });
		return result > 0;
	}

	async updateActiveStatus(eventid: number | string, active: boolean): Promise<boolean> {
		const conn = await this.connection;
		return await conn(this.tablename).where({ eventid: Number(eventid) }).update({ active });
	}
}
