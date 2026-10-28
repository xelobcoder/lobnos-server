import { PrimeSmsJob, PrimeSmsJobsRepo } from '../repositories/PrimeSmsJobsRepo';
import { PrimeSmsJobRecipientsRepo } from '../repositories/PrimeSmsJobRecipientsRepo';
import { CreateSmsJobDto, CreateSmsJobSchema } from '../dtos/CreateSmsJobDto';
import KnexConnection from '../../../../database/KnexConnections';
import { SmsMessageParser } from '../PrimeSms/SmsMessageParser';
import { SmsService } from '../../integrations/Arkesel';
import { PrimeSmsTemplatesRepo } from '../repositories/PrimeSmsTemplatesRepo';
import { Logger } from './Logger';

/** Match local and international representations returned by the SMS provider. */
export function smsRecipientKey(phone: unknown): string {
	let digits = String(phone ?? '').replace(/\D/g, '').replace(/^00/, '');
	if (digits.startsWith('233') && digits.length === 12) return digits.slice(3);
	if (digits.startsWith('0') && digits.length === 10) return digits.slice(1);
	return digits;
}

export function mapJobDtoToDb(dto: Partial<CreateSmsJobDto>) {
	const result: any = {};
	const fields = { templateId: 'templateid', customBody: 'custombody', category: 'category',
		recipientScope: 'recipientscope', sendType: 'sendtype', status: 'status', createdBy: 'createdby' };
	for (const [input, column] of Object.entries(fields)) {
		if (dto[input] !== undefined) result[column] = dto[input];
	}
	if (dto.scheduledAt !== undefined) result.scheduledat = new Date(dto.scheduledAt);
	if (dto.targetIds !== undefined) result.targetids = dto.recipientScope === 'all' ? JSON.stringify(dto.targetIds) : null;
	return result;
}

export class SmsJobsService {
	constructor(
		private jobsRepo: PrimeSmsJobsRepo,
		private jobRecipientsRepo: PrimeSmsJobRecipientsRepo,
		private tenantId: number,
	) { }

	async createJob(input: CreateSmsJobDto, tenantId: number) {
		if (Number(tenantId) !== Number(this.tenantId)) throw new Error('SMS tenant mismatch');
		const dto = CreateSmsJobSchema.parse(input);
		if (dto.customBody) dto.templateId = undefined;
		const connection = await KnexConnection(this.tenantId);
		const jobId = await connection.transaction(async trx => {
			const id = await this.jobsRepo.create(mapJobDtoToDb({ ...dto, status: 'pending' }), trx);
			if (dto.recipientScope !== 'all') {
				const targets = dto.targetIds as Array<{ id: number; phone: string }>;
				const unique = [...new Map(targets.map(target => [smsRecipientKey(target.phone), target])).values()];
				const recipients = await Promise.all(unique.map(async target => ({
					phonee164: String(target.phone).replace(/[\s()-]/g, ''), refid: target.id,
					personalizedbody: dto.customBody || await new SmsMessageParser(this.tenantId, dto.category, target.id)
						.humanizeTemplate({ ...target, templateid: dto.templateId }),
				})));
				await this.jobRecipientsRepo.bulkInsert(id, recipients, trx);
			}
			return id;
		});
		// Delivery starts only after persistence succeeds. A provider failure must
		// never turn an already-created campaign into an apparent creation failure.
		void this.processJobData(jobId).catch(async error => {
			Logger.error('SMS job processing failed: ' + jobId, error);
			try { await this.jobsRepo.update(jobId, { status: 'failed' }); }
			catch (updateError) { Logger.error('Unable to record SMS job failure: ' + jobId, updateError); }
		});
		return jobId;
	}

	async getJobById(jobId: number) {
		return this.jobsRepo.findById(jobId);
	}

	async updateJob(jobId: number, dto: Partial<CreateSmsJobDto>) {
		return this.jobsRepo.update(jobId, mapJobDtoToDb(dto));
	}

	async deleteJob(jobId: number) {
		return this.jobsRepo.delete(jobId);
	}

	async getAllJobsPaginated(page: number, count: number) {
		return this.jobsRepo.findAllPaginated(page, count);
	}


	private async processJobData(jobid: number) {
		const job = await this.jobsRepo.findById(jobid);
		if (!job) throw new Error(`Job with ID ${jobid} not found`);
		const { templateid, custombody, recipientscope, sendtype, scheduledat, status } = job;
		if (status === "sent" || status === "processing") return;

		if (recipientscope === 'all') {
			await this.processBatchJob(this.tenantId, job);
			return;
		}

		const recipients = await this.jobRecipientsRepo.findAllByJob(jobid);
		const isScheduled = sendtype === 'scheduled' && scheduledat;
		const hasCustomBody = !templateid && custombody !== null && custombody !== undefined;

		if (isScheduled) {
			try {
				await this.processScheduledJobs(jobid, hasCustomBody, recipients, custombody, scheduledat);
			} catch (err) {
				await this.jobsRepo.update(jobid, { status: 'failed' });
				Logger.error('Job processing failed: ' + jobid, err);
			}
			return;
		}

		if (sendtype === "immediate" && status !== 'pending') {
			const hasTemplate = templateid !== null && templateid !== undefined;
			const hasCustomBodyImmediate = custombody !== null && custombody !== undefined;
			if (!hasTemplate && !hasCustomBodyImmediate) {
				Logger.error('Job has no template or custom body: ' + jobid);
				return;
			}
		}

		await this.processSingleOrMultipleJob(job, recipients);
		await this.refreshJobStatus(job.jobid);
	}

	private async refreshJobStatus(jobid: number) {
		const recipients = await this.jobRecipientsRepo.findAllByJob(jobid);
		const sent = recipients.filter(row => row.deliverystatus === 'sent').length;
		const failed = recipients.filter(row => row.deliverystatus === 'failed').length;
		const status = !recipients.length ? 'failed' : sent === recipients.length ? 'sent' :
			failed === recipients.length ? 'failed' : failed > 0 ? 'partialfailed' : 'pending';
		await this.jobsRepo.update(jobid, { status });
	}

	private async processSingleOrMultipleJob(job: PrimeSmsJob, recipients: any[], isAll: boolean = false) {
		const smsService = new SmsService(this.tenantId)
		if (recipients.length === 1) {
			// Single recipient
			const recipient = recipients[0];
			if (!job.templateid && job.custombody) {
				try {
					const result = await smsService.sendSms([recipient.phonee164], job.custombody);
					if (result.status === 'success' && Array.isArray(result.data) && result.data[0]) {
						if (isAll) {
							await this.jobRecipientsRepo.create({
								jobid: job.jobid,
								phonee164: recipient.phonee164,
								personalizedbody: job.custombody,
								deliverystatus: 'sent',
								messageid: result.data[0].id,
								refid: recipient.id || recipient.refid,
								sentat: new Date()
							});
						} else {
							await this.jobRecipientsRepo.update(recipient.recid, {
								deliverystatus: 'sent',
								messageid: result.data[0].id,
								sentat: new Date()
							});
						}
						// Update job status to sent
						await this.jobsRepo.update(job.jobid, { status: 'sent' });
					} else {
						Logger.error('Error sending single SMS:', result.message);
						if (isAll) {
							await this.jobRecipientsRepo.create({
								jobid: job.jobid,
								phonee164: recipient.phonee164,
								personalizedbody: job.custombody,
								deliverystatus: 'failed',
								messageid: null,
								refid: recipient.id || recipient.refid,
								errorcode: result.message,
								sentat: new Date()
							});
						} else if (recipient.recid !== undefined && recipient.recid !== null) {
							await this.jobRecipientsRepo.update(recipient.recid, {
								deliverystatus: 'failed',
								messageid: null,
								errorcode: result.message,
								sentat: new Date()
							});
						}
					}
				} catch (err) {
					Logger.error('Error sending single SMS (exception):', err);
					if (isAll) {
						await this.jobRecipientsRepo.create({
							jobid: job.jobid,
							phonee164: recipient.phonee164,
							personalizedbody: job.custombody,
							deliverystatus: 'failed',
							messageid: null,
							refid: recipient.id || recipient.refid,
							errorcode: err?.message || String(err)
						});
					} else if (recipient.recid !== undefined && recipient.recid !== null) {
						await this.jobRecipientsRepo.update(recipient.recid, {
							deliverystatus: 'failed',
							messageid: null,
							errorcode: err?.message || String(err)
						});
					}
				}
			} else if (job.templateid) {
				try {
					const result = await smsService.sendSms([recipient.phonee164], recipient.personalizedbody);
					if (result.status === 'success' && Array.isArray(result.data) && result.data[0]) {
						if (isAll) {
							await this.jobRecipientsRepo.create({
								jobid: job.jobid,
								phonee164: recipient.phonee164,
								personalizedbody: recipient.personalizedbody,
								deliverystatus: 'sent',
								messageid: result.data[0].id,
								refid: recipient.id || recipient.refid
							});
						} else {
							await this.jobRecipientsRepo.update(recipient.recid, {
								deliverystatus: 'sent',
								messageid: result.data[0].id
							});
						}
						// Update job status to sent
						await this.jobsRepo.update(job.jobid, { status: 'sent' });
					} else {
						Logger.error('Error sending single SMS (template):', result.message);
						if (isAll) {
							await this.jobRecipientsRepo.create({
								jobid: job.jobid,
								phonee164: recipient.phonee164,
								personalizedbody: recipient.personalizedbody,
								deliverystatus: 'failed',
								messageid: null,
								refid: recipient.id || recipient.refid,
								errorcode: result.message
							});
						} else if (recipient.recid !== undefined && recipient.recid !== null) {
							await this.jobRecipientsRepo.update(recipient.recid, {
								deliverystatus: 'failed',
								messageid: null,
								errorcode: result.message
							});
						}
					}
				} catch (err) {
					Logger.error('Error sending single SMS (template) (exception):', err);
					if (isAll) {
						await this.jobRecipientsRepo.create({
							jobid: job.jobid,
							phonee164: recipient.phonee164,
							personalizedbody: recipient.personalizedbody,
							deliverystatus: 'failed',
							messageid: null,
							refid: recipient.id || recipient.refid,
							errorcode: err?.message || String(err)
						});
					} else if (recipient.recid !== undefined && recipient.recid !== null) {
						await this.jobRecipientsRepo.update(recipient.recid, {
							deliverystatus: 'failed',
							messageid: null,
							errorcode: err?.message || String(err)
						});
					}
				}
			}
		} else if (recipients.length > 1) {
			// Multiple recipients
			if (!job.templateid && job.custombody) {
				try {
					const numbers = recipients.map(r => r.phonee164);
					const result = await smsService.sendSms(numbers, job.custombody);
					if (result.status === 'success' && Array.isArray(result.data)) {
						// Map phone to message id
						let allSent = true;
						for (const recipient of recipients) {
							const sentInfo = result.data.find((d: any) => smsRecipientKey(d.recipient) === smsRecipientKey(recipient.phonee164));
							if (isAll) {
								await this.jobRecipientsRepo.create({
									jobid: job.jobid,
									phonee164: recipient.phonee164,
									personalizedbody: job.custombody,
									deliverystatus: sentInfo ? 'sent' : 'failed',
									messageid: sentInfo ? sentInfo.id : null,
									refid: recipient.id || recipient.refid
								});
							} else {
								await this.jobRecipientsRepo.update(recipient.recid, {
									deliverystatus: sentInfo ? 'sent' : 'failed',
									messageid: sentInfo ? sentInfo.id : null
								});
							}
							if (!sentInfo) allSent = false;
						}
						if (allSent) {
							await this.jobsRepo.update(job.jobid, { status: 'sent' });
						}
					} else {
						Logger.error('Error sending bulk SMS (custom body):', result.message);
						for (const recipient of recipients) {
							if (isAll) {
								await this.jobRecipientsRepo.create({
									jobid: job.jobid,
									phonee164: recipient.phonee164,
									personalizedbody: job.custombody,
									deliverystatus: 'failed',
									messageid: null,
									refid: recipient.id || recipient.refid,
									errorcode: result.message
								});
							} else if (recipient.recid !== undefined && recipient.recid !== null) {
								await this.jobRecipientsRepo.update(recipient.recid, {
									deliverystatus: 'failed',
									messageid: null,
									errorcode: result.message
								});
							}
						}
					}
				} catch (err) {
					Logger.error('Error sending bulk SMS (custom body) (exception):', err);
					for (const recipient of recipients) {
						if (isAll) {
							await this.jobRecipientsRepo.create({
								jobid: job.jobid,
								phonee164: recipient.phonee164,
								personalizedbody: job.custombody,
								deliverystatus: 'failed',
								messageid: null,
								refid: recipient.id || recipient.refid,
								errorcode: err?.message || String(err),
								sentat: new Date()
							});
						} else if (recipient.recid !== undefined && recipient.recid !== null) {
							await this.jobRecipientsRepo.update(recipient.recid, {
								deliverystatus: 'failed',
								messageid: null,
								errorcode: err?.message || String(err),
								sentat: new Date()
							});
						}
					}
				}
			} else if (job.templateid) {
				let allSent = true;
				for (const recipient of recipients) {
					try {
						const result = await smsService.sendSms([recipient.phonee164], recipient.personalizedbody);
						if (result.status === 'success' && Array.isArray(result.data) && result.data[0]) {
							if (isAll) {
								await this.jobRecipientsRepo.create({
									jobid: job.jobid,
									phonee164: recipient.phonee164,
									personalizedbody: recipient.personalizedbody,
									deliverystatus: 'sent',
									messageid: result.data[0].id,
									refid: recipient.id || recipient.refid,
									sentat: new Date()
								});
							} else {
								await this.jobRecipientsRepo.update(recipient.recid, {
									deliverystatus: 'sent',
									messageid: result.data[0].id,
									sentat: new Date()
								});
							}
						} else {
							allSent = false;
							Logger.error('Error sending personalized SMS:', result.message);
							if (isAll) {
								await this.jobRecipientsRepo.create({
									jobid: job.jobid,
									phonee164: recipient.phonee164,
									personalizedbody: recipient.personalizedbody,
									deliverystatus: 'failed',
									messageid: null,
									refid: recipient.id || recipient.refid,
									errorcode: result.message,
									sentat: new Date()
								});
							} else if (recipient.recid !== undefined && recipient.recid !== null) {
								await this.jobRecipientsRepo.update(recipient.recid, {
									deliverystatus: 'failed',
									messageid: null,
									errorcode: result.message,
									sentat: new Date()
								});
							}
						}
					} catch (err) {
						console.log(err)
						allSent = false;
						Logger.error('Error sending personalized SMS (exception):', err);
						if (isAll) {
							await this.jobRecipientsRepo.create({
								jobid: job.jobid,
								phonee164: recipient.phonee164,
								personalizedbody: recipient.personalizedbody,
								deliverystatus: 'failed',
								messageid: null,
								refid: recipient.id || recipient.refid,
								errorcode: err?.message || String(err),
								sentat: new Date()
							});
						} else if (recipient.recid !== undefined && recipient.recid !== null) {
							await this.jobRecipientsRepo.update(recipient.recid, {
								deliverystatus: 'failed',
								messageid: null,
								errorcode: err?.message || String(err),
								sentat: new Date()
							});
						}
					}
				}
				if (allSent) {
					await this.jobsRepo.update(job.jobid, { status: 'sent' });
				}
			}
		}
	}

	private async processBatchJob(tenantId: number, job: PrimeSmsJob) {
		try {
			//  1. get the total using the category
			const { category, targetids, templateid } = job;
			const smsService = new SmsMessageParser(tenantId, category, targetids);
			const totalCount = await smsService.getTotalCount();
			const batchSize = 50;
			let offset = 0;

			while (offset < totalCount) {

				const data = await smsService.loadBatchData(offset, batchSize);

				if (!data || (Array.isArray(data) && data.length === 0)) {
					Logger.info(`[BatchJob] No more data to process at offset ${offset}.`);
					break;
				}

				const batch = Array.isArray(data) ? data : [data];
				const batchIds = batch.map((recipient: any) => recipient.id || recipient.refid);


				const alreadySent = await this.jobRecipientsRepo.findByJobAndRefids(job.jobid, batchIds);
				// Only consider as already sent if deliverystatus is 'sent'
				const alreadySentRefIds = new Set(
					alreadySent
						.filter(r => r.deliverystatus === 'sent')
						.map(r => r.refid)
				);

				const recipients = batch.filter((recipient: any) => !alreadySentRefIds.has(recipient.id || recipient.refid));

				if (recipients.length === 0) {

					offset += batchSize;
					continue;
				}

				const hasCustomBody = !templateid && job.custombody !== null && job.custombody !== undefined;
				const isScheduled = job.sendtype === 'scheduled' && job.scheduledat;

				if (hasCustomBody) {
					for (let i = 0; i < recipients.length; i++) {
						(recipients[i] as any).personalizedbody = job.custombody;
					}
				} else {
					const template = await new PrimeSmsTemplatesRepo(tenantId).findById(job.templateid);
					if (!template) {
						throw new Error(`Template with ID ${job.templateid} not found`);
					}
					for (let i = 0; i < recipients.length; i++) {
						const personalizedBody = SmsMessageParser.parse(
							template.body,
							recipients[i],
						);
						(recipients[i] as any).personalizedbody = personalizedBody;
					}
				}

				if (isScheduled) {

					await this.processScheduledJobs(job.jobid, hasCustomBody, recipients, job.custombody, job.scheduledat, true);
					offset += batch.length;
					continue;
				}

				await this.processSingleOrMultipleJob(job, recipients, true);

				offset += batch.length;
			}
			await this.refreshJobStatus(job.jobid);
		} catch (error) {
			Logger.error('Error processing batch job:', error);
			throw new Error('Failed to process batch job. Please try again later.');
		}
	}

	public async processScheduledJobs(jobid: number, hasCustomBody: boolean, recipients: any[], custombody?: string, scheduledat?: Date, isAll: boolean = false) {
		try {
			if (hasCustomBody && custombody) {
				const status = await new SmsService(this.tenantId).scheduleSms(
					recipients.map(r => r.phonee164),
					custombody,
					scheduledat?.toISOString() || '',
				);

				if (status.status === 'success' && Array.isArray(status.data)) {
					for (let i = 0; i < recipients.length; i++) {
						if (isAll) {
							// Insert new recipient record for 'all' jobs
							await this.jobRecipientsRepo.create({
								jobid,
								phonee164: recipients[i].phonee164,
								personalizedbody: custombody,
								deliverystatus: 'sent',
								messageid: null,
								refid: recipients[i].refid
							});
						} else {
							const deliveryStatus = await this.jobRecipientsRepo.update(recipients[i].recid, {
								deliverystatus: 'sent',
								messageid: null
							});

						}
					}
					if (recipients.length > 0) {
						await this.jobsRepo.update(jobid, { status: 'sent' });
					}
				}
				return status;
			} else {
				let allSent = true;
				for (const recipient of recipients) {
					if (recipient.personalizedbody) {
						const status = await new SmsService(this.tenantId).scheduleSms(
							[recipient.phonee164],
							recipient.personalizedbody,
							scheduledat?.toISOString() || '',
						);
						if (status.status === 'success') {
							if (isAll) {
								await this.jobRecipientsRepo.create({
									jobid,
									phonee164: recipient.phonee164,
									personalizedbody: recipient.personalizedbody,
									deliverystatus: 'sent',
									messageid: null,
									refid: recipient.id || recipient.refid
								});
							} else {
								const deliveryStatus = await this.jobRecipientsRepo.update(recipient.recid, {
									deliverystatus: 'sent',
									messageid: null
								});

							}
						} else {
							allSent = false;
						}
					}
				}
				if (allSent && recipients.length > 0) {
					await this.jobsRepo.update(jobid, { status: 'sent' });
				}
			}
		} catch (error) {
			Logger.error('Error processing scheduled jobs:', error);
			throw new Error('Failed to process scheduled jobs. Please try again later.');
		}
	}

	public async retryFailedTransaction(tenantId: number, jobid: number, refid: string | number): Promise<{ status: string; message: string }> {
		if (Number(tenantId) !== Number(this.tenantId)) return { status: 'error', message: 'SMS tenant mismatch' };
		const job = await this.jobsRepo.findById(jobid);
		if (!job) return { status: 'error', message: `Job with ID ${jobid} not found` };
		const recipients = await this.jobRecipientsRepo.findByJobAndRefids(jobid, [refid]);
		if (!recipients || recipients.length === 0) return { status: 'error', message: `Recipient with refid ${refid} not found for job ${jobid}` };
		const recipient = recipients[0];
		if (recipient.deliverystatus === 'sent') {
			return { status: 'error', message: 'Recipient has already been sent SMS. Retry not allowed.' };
		}

		let personalizedBody = recipient.personalizedbody;
		if (!personalizedBody) {
			if (job.templateid) {
				const template = await new PrimeSmsTemplatesRepo(tenantId).findById(job.templateid);
				if (!template) throw new Error(`Template with ID ${job.templateid} not found`);
				personalizedBody = SmsMessageParser.parse(template.body, recipient);
			} else if (job.custombody) {
				personalizedBody = job.custombody;
			} else {
				throw new Error('No message body available for retry.');
			}
		}

		if (recipient.deliverystatus !== 'failed') return { status: 'error', message: 'Only failed messages can be retried.' };
		const claimed = await this.jobRecipientsRepo.claimFailedRecipient(recipient.recid);
		if (!claimed) return { status: 'error', message: 'This message is already being retried. Refresh its status.' };
		let result: any;
		try {
			result = await new SmsService(this.tenantId).sendSms([recipient.phonee164], personalizedBody);
		} catch (error) {
			await this.jobRecipientsRepo.update(recipient.recid, { deliverystatus: 'failed', errorcode: 'Provider request failed' });
			Logger.error('SMS retry provider request failed', error);
			return { status: 'error', message: 'Unable to retry the message. Review its delivery status before retrying.' };
		}
		const acknowledged = result.status === 'success' && Array.isArray(result.data) && result.data[0]?.id;
		await this.jobRecipientsRepo.update(recipient.recid, {
			deliverystatus: acknowledged ? 'sent' : 'failed', messageid: acknowledged ? result.data[0].id : null,
			errorcode: acknowledged ? null : 'Provider did not acknowledge this message', sentat: new Date(),
		});
		try { await this.refreshJobStatus(jobid); }
		catch (error) { Logger.error('Unable to refresh SMS campaign totals after retry', error); }
		return acknowledged ? { status: 'success', message: 'Message accepted by the SMS provider.' } :
			{ status: 'error', message: 'The SMS provider did not accept this message.' };

	}
}

