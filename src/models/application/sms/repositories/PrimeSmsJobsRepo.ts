import KnexConnection from "../../../../database/KnexConnections";

export interface PrimeSmsJob {
	jobid?: number;
	templateid?: number;
	custombody?: string; // <-- allow custom message
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

	async create(data: PrimeSmsJob,trx:any): Promise<number> {
		const connection =  await trx ||  this.connection;
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

	async findAllPaginated(page: number, count: number): Promise<{ jobs: PrimeSmsJob[]; total: number }> {
		const connection = await this.connection;
		const totalResult = await connection(this.tablename).count('* as count');
		const jobs = await connection(this.tablename)
			.select()
			.offset((page - 1) * count)
			.limit(count);
		const total = Number((totalResult[0] && (totalResult[0].count || totalResult[0]['count'])) || 0);
		return { jobs, total };
	}
}
