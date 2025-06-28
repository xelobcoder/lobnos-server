import KnexConnection from "../../../../database/KnexConnections";

export interface PrimeSmsJob {
	jobid?: number;
	templateid?: number;
	category: 'patient' | 'clinician' | 'organization';
	recipientscope: 'single' | 'multiple' | 'all';
	targetids?: any;
	sendtype: 'immediate' | 'scheduled';
	scheduledat?: Date;
	status?: 'pending' | 'processing' | 'sent' | 'partialfailed' | 'failed';
	createdby: number;
	createdat?: Date;
}

export class PrimeSmsJobsRepo {
	private connection;
	private tablename = "primesmsjobs";

	constructor(private tenantId: number) {
		this.connection = KnexConnection(tenantId);
	}

	async create(data: PrimeSmsJob): Promise<number> {
		const connection = await this.connection;
		const [id] = await connection(this.tablename).insert(data).returning('jobid');
		return id;
	}

	async findById(jobid: number): Promise<PrimeSmsJob | null> {
		const connection = await this.connection;
		const result = await connection(this.tablename).where({ jobid }).first();
		return result || null;
	}

	async findAll(): Promise<PrimeSmsJob[]> {
		const connection = await this.connection;
		return await connection(this.tablename).select();
	}

	async update(jobid: number, data: Partial<PrimeSmsJob>): Promise<number> {
		const connection = await this.connection;
		return await connection(this.tablename).where({ jobid }).update(data);
	}

	async delete(jobid: number): Promise<number> {
		const connection = await this.connection;
		return await connection(this.tablename).where({ jobid }).del();
	}
}
