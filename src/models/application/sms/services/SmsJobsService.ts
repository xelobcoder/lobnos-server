import { PrimeSmsJob, PrimeSmsJobsRepo } from '../repositories/PrimeSmsJobsRepo';
import { PrimeSmsJobRecipientsRepo } from '../repositories/PrimeSmsJobRecipientsRepo';
import { CreateSmsJobDto } from '../dtos/CreateSmsJobDto';
import KnexConnection from '../../../../database/KnexConnections';
import { SmsMessageParser } from '../PrimeSms/SmsMessageParser';
import { SmsService } from '../../integrations/Arkesel';

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

                                   const personalizedbody = await new SmsMessageParser(tenantId, dto.category, target.id).humanizeTemplate({
                                        ...target,
                                        templateid: dto.templateId,
                                   })

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
                    // For 'all', we assume targetIds is not used and no recipients are created
                    await trx.commit();
               }
               return jobId;
          } catch (error) {
               console.error('Error creating SMS job:', error);
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

          const recipients = await this.jobRecipientsRepo.findAllByJob(jobid);
          const isScheduled = sendtype === 'scheduled' && scheduledat;
          const hasCustomBody = !templateid && custombody !== null && custombody !== undefined;

          if (recipientscope === 'all') {
               await this.processBatchJob(job);
               return;
          }

          if (isScheduled) {
               try {
                    await this.processScheduledJobs(jobid, hasCustomBody, recipients, custombody, scheduledat);
               } catch (err) {
                    await this.jobsRepo.update(jobid, { status: 'failed' });
                    console.error('Job processing failed:', jobid, err);
               }
               return;
          }

          if (sendtype === "immediate" && status !== 'pending') {
               const hasTemplate = templateid !== null && templateid !== undefined;
               const hasCustomBodyImmediate = custombody !== null && custombody !== undefined;
               if (!hasTemplate && !hasCustomBodyImmediate) {
                    console.error('Job has no template or custom body:', jobid);
                    return;
               }
          }

          await this.processSingleOrMultipleJob(job, recipients);
     }

     private async processSingleOrMultipleJob(job: PrimeSmsJob, recipients: any[]) {
          const smsService = new SmsService();
          if (recipients.length === 1) {
               // Single recipient
               const recipient = recipients[0];
               if (!job.templateid && job.custombody) {
                    try {
                         const result = await smsService.sendSms([recipient.phonee164], job.custombody);
                         if (result.status === 'success' && Array.isArray(result.data) && result.data[0]) {
                              await this.jobRecipientsRepo.update(recipient.recid, {
                                   deliverystatus: 'sent',
                                   messageid: result.data[0].id
                              });
                              // Update job status to sent
                              await this.jobsRepo.update(job.jobid, { status: 'sent' });
                         }
                    } catch (err) {
                         console.error('Error sending single SMS:', err);
                    }
               } else if (job.templateid) {
                    try {
                         const result = await smsService.sendSms([recipient.phonee164], recipient.personalizedbody);
                         //
                         if (result.status === 'success' && Array.isArray(result.data) && result.data[0]) {
                              await this.jobRecipientsRepo.update(recipient.recid, {
                                   deliverystatus: 'sent',
                                   messageid: result.data[0].id
                              });
                              // Update job status to sent
                              await this.jobsRepo.update(job.jobid, { status: 'sent' });
                         }
                    } catch (err) {
                         console.error('Error sending single SMS (template):', err);
                    }
               }
          } else if (recipients.length > 1) {
               // Multiple recipients
               if (!job.templateid && job.custombody) {
                    try {
                         const numbers = recipients.map(r => r.phonee164);
                         const result = await smsService.sendSms(numbers, job.custombody);
                         //
                         if (result.status === 'success' && Array.isArray(result.data)) {
                              // Map phone to message id
                              let allSent = true;
                              for (const recipient of recipients) {
                                   const sentInfo = result.data.find((d: any) => d.recipient === recipient.phonee164.replace(/^\+/, ''));
                                   const updateResult = await this.jobRecipientsRepo.update(recipient.recid, {
                                        deliverystatus: 'sent',
                                        messageid: sentInfo ? sentInfo.id : null
                                   });
                                   if (!sentInfo) allSent = false;
                              }
                              if (allSent) {
                                   await this.jobsRepo.update(job.jobid, { status: 'sent' });
                              }
                         }
                    } catch (err) {
                         console.error('Error sending bulk SMS (custom body):', err);
                    }
               } else if (job.templateid) {
                    let allSent = true;
                    for (const recipient of recipients) {
                         try {
                              const result = await smsService.sendSms([recipient.phonee164], recipient.personalizedbody);
                              //
                              if (result.status === 'success' && Array.isArray(result.data) && result.data[0]) {
                                   await this.jobRecipientsRepo.update(recipient.recid, {
                                        deliverystatus: 'sent',
                                        messageid: result.data[0].id
                                   });
                              } else {
                                   allSent = false;
                              }
                         } catch (err) {
                              allSent = false;
                              console.error('Error sending personalized SMS:', err);
                         }
                    }
                    if (allSent) {
                         await this.jobsRepo.update(job.jobid, { status: 'sent' });
                    }
               }
          }
     }

     private async processBatchJob(job: PrimeSmsJob) {
          //
     }

     public async processScheduledJobs(jobid: number, hasCustomBody: boolean, recipients: any[], custombody?: string, scheduledat?: Date) {
          try {
               if (hasCustomBody && custombody) {
                    const status = await new SmsService().scheduleSms(
                         recipients.map(r => r.phonee164),
                         custombody,
                         scheduledat?.toISOString() || '',
                    );
                    console.log('Scheduled SMS status:', status);
                    if (status.status === 'success' && Array.isArray(status.data)) {
                         for (let i = 0; i < recipients.length; i++) {
                              const deliveryStatus = await this.jobRecipientsRepo.update(recipients[i].recid, {
                                   deliverystatus: 'sent',
                                   messageid: null
                              });
                              console.log('Delivery status updated:', deliveryStatus);
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
                              console.log('Scheduled SMS status:', status);
                              if (status.status === 'success') {
                                   const deliveryStatus = await this.jobRecipientsRepo.update(recipient.recid, {
                                        deliverystatus: 'sent',
                                        messageid: null
                                   });
                                   console.log('Delivery status updated:', deliveryStatus);
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
               console.error('Error processing scheduled jobs:', error);
               throw new Error('Failed to process scheduled jobs. Please try again later.');
          }
     }
}
