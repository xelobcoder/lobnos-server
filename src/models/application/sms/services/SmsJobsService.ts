import { PrimeSmsJob, PrimeSmsJobsRepo } from '../repositories/PrimeSmsJobsRepo';
import { PrimeSmsJobRecipientsRepo } from '../repositories/PrimeSmsJobRecipientsRepo';
import { CreateSmsJobDto } from '../dtos/CreateSmsJobDto';
import KnexConnection from '../../../../database/KnexConnections';
import { SmsMessageParser } from '../PrimeSms/SmsMessageParser';
import { SmsService } from '../../integrations/Arkesel';
import { PrimeSmsTemplatesRepo } from '../repositories/PrimeSmsTemplatesRepo';
import { Logger } from './Logger';

function mapJobDtoToDb(dto: any) {
	return {
		templateid: dto.templateId,
		custombody: dto.customBody ? dto.customBody : null,
		category: dto.category,
		recipientscope: dto.recipientScope,
		targetids: dto.recipientScope === 'all' ? dto.targetIds : null,
		sendtype: dto.sendType,
		scheduledat: (typeof dto.scheduledAt === 'string' && !isNaN(Date.parse(dto.scheduledAt))) ? new Date(dto.scheduledAt) : null,
		status: dto.status ? dto.status : 'pending',
		createdby: dto.createdBy,
	};
}

export class SmsJobsService {
	constructor(
		private jobsRepo: PrimeSmsJobsRepo,
		private jobRecipientsRepo: PrimeSmsJobRecipientsRepo
	) { }

	async createJob(dto: CreateSmsJobDto, tenantId: number) {
		try {
			// 1. Create the job
			const transaction = await KnexConnection(tenantId);
			const trx = await transaction.transaction();
			const jobId = await this.jobsRepo.create(mapJobDtoToDb(dto), trx);

			if (dto.recipientScope !== 'all' && dto.targetIds) {
				const targets = Array.isArray(dto.targetIds) ? dto.targetIds : [dto.targetIds];
				// Validate phone numbers (simple E.164 regex, can be improved)
				const validPhone = (phone: string) => /^\+?\d{7,15}$/.test(phone);
				let recipients = await Promise.all(
					targets
						.filter((target: any) => target.phone && validPhone(target.phone))
						.map(async (target: any) => {
							const personalizedbody = dto.customBody
								? dto.customBody
								: await new SmsMessageParser(tenantId, dto.category, target.id).humanizeTemplate({ ...target, templateid: dto.templateId });

							return {
								phonee164: target.phone,
								personalizedbody,
								refid: target.id
							};
						})
				);

				if (recipients.length !== targets.length) {
					throw new Error('One or more recipient phone numbers are invalid.');
				}

				this.jobRecipientsRepo = this.jobRecipientsRepo || new PrimeSmsJobRecipientsRepo(tenantId);

				if (!this.jobRecipientsRepo) {
					throw new Error('jobRecipientsRepo is not initialized. Please ensure you pass it to the SmsJobsService constructor.');
				}

				await this.jobRecipientsRepo.bulkInsert(jobId, recipients, trx);

				await trx.commit();
				this.processJobData(jobId);

			} else if (dto.recipientScope === 'all') {
				await trx.commit();
				// 1. load the batch job
				const info = await this.jobsRepo.findById(jobId);
				this.processBatchJob(3, info);
			}
			return jobId;
		} catch (error) {
			Logger.error('Error creating SMS job:', error);
			throw new Error('Failed to create SMS job. Please try again later.');
		}
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
			this.processBatchJob(3, job);
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
	}

	private async processSingleOrMultipleJob(job: PrimeSmsJob, recipients: any[], isAll: boolean = false) {
		const smsService = new SmsService()
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
					} else if (result.status === 'error') {
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
					} else if (result.status === 'error') {
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
							const sentInfo = result.data.find((d: any) => d.recipient === recipient.phonee164.replace(/^\+/, ''));
							if (isAll) {
								await this.jobRecipientsRepo.create({
									jobid: job.jobid,
									phonee164: recipient.phonee164,
									personalizedbody: job.custombody,
									deliverystatus: 'sent',
									messageid: sentInfo ? sentInfo.id : null,
									refid: recipient.id || recipient.refid
								});
							} else {
								await this.jobRecipientsRepo.update(recipient.recid, {
									deliverystatus: 'sent',
									messageid: sentInfo ? sentInfo.id : null
								});
							}
							if (!sentInfo) allSent = false;
						}
						if (allSent) {
							await this.jobsRepo.update(job.jobid, { status: 'sent' });
						}
					} else if (result.status === 'error') {
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
						console.log('Result', result)
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
						} else if (result.status === 'error') {
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
						} else {
							allSent = false;
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
			let offset = 1;

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
					Logger.info(JSON.stringify(template));
					for (let i = 0; i < recipients.length; i++) {
						const personalizedBody = SmsMessageParser.parse(
							template.body,
							recipients[i],
						)
						Logger.info('Personalized body: ' + personalizedBody);
						(recipients[i] as any).personalizedbody = personalizedBody;
					}
				}

				if (isScheduled) {

					await this.processScheduledJobs(job.jobid, hasCustomBody, recipients, job.custombody, job.scheduledat, true);
					offset += recipients.length;
					continue;
				}

				await this.processSingleOrMultipleJob(job, recipients, true);

				offset += recipients.length;
			}
		} catch (error) {
			Logger.error('Error processing batch job:', error);
			throw new Error('Failed to process batch job. Please try again later.');
		}
	}

	public async processScheduledJobs(jobid: number, hasCustomBody: boolean, recipients: any[], custombody?: string, scheduledat?: Date, isAll: boolean = false) {
		try {
			if (hasCustomBody && custombody) {
				const status = await new SmsService().scheduleSms(
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
						const status = await new SmsService().scheduleSms(
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

		// Send SMS
		const smsService = new SmsService();
		try {
			const result = await smsService.sendSms([recipient.phonee164], personalizedBody);
			if (result.status === 'success' && Array.isArray(result.data) && result.data[0]) {
				await this.jobRecipientsRepo.update(recipient.recid, {
					deliverystatus: 'sent',
					messageid: result.data[0].id,
					sentat: new Date(),
					errorcode: null
				});
			} else if (result.status === 'error') {
				Logger.error('Retry failed (API error):', result.message);
				await this.jobRecipientsRepo.update(recipient.recid, {
					deliverystatus: 'failed',
					messageid: null,
					errorcode: result.message,
					sentat: new Date()
				});
			}
		} catch (err) {
			Logger.error('Retry failed (exception):', err);
			await this.jobRecipientsRepo.update(recipient.recid, {
				deliverystatus: 'failed',
				messageid: null,
				errorcode: err?.message || String(err),
				sentat: new Date()
			});
			return { status: 'error', message: 'Failed to retry sending SMS. Please try again later.' };
		}
	}
}


