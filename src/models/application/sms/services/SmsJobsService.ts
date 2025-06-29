
import { PrimeSmsJob, PrimeSmsJobsRepo } from '../repositories/PrimeSmsJobsRepo'
import { PrimeSmsJobRecipientsRepo } from '../repositories/PrimeSmsJobRecipientsRepo'
import { CreateSmsJobDto } from '../dtos/CreateSmsJobDto'
import KnexConnection from '../../../../database/KnexConnections'
import { SmsMessageParser } from '../PrimeSms/SmsMessageParser'
import { SmsService } from '../../integrations/Arkesel'

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
     }
}


export class SmsJobsService {
     constructor(
          private jobsRepo: PrimeSmsJobsRepo,
          private jobRecipientsRepo: PrimeSmsJobRecipientsRepo
     ) { }

     async createJob(dto: CreateSmsJobDto, tenantId: number) {
          try {
               const transaction = await KnexConnection(tenantId)
               const trx = await transaction.transaction()
               const jobId = await this.jobsRepo.create(mapJobDtoToDb(dto), trx)
               if (dto.recipientScope !== 'all' && dto.targetIds) {
                    const targets = Array.isArray(dto.targetIds) ? dto.targetIds : [dto.targetIds]
                    const validPhone = (phone: string) => /^\+?\d{7,15}$/.test(phone)
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
                                   }
                              })
                    )
                    if (recipients.length !== targets.length) {
                         throw new Error('One or more recipient phone numbers are invalid.')
                    }
                    this.jobRecipientsRepo = this.jobRecipientsRepo || new PrimeSmsJobRecipientsRepo(tenantId)
                    if (!this.jobRecipientsRepo) {
                         throw new Error('jobRecipientsRepo is not initialized. Please ensure you pass it to the SmsJobsService constructor.')
                    }
                    await this.jobRecipientsRepo.bulkInsert(jobId, recipients, trx)
                    await trx.commit()
                    this.processJobData(jobId)
               } else if (dto.recipientScope === 'all') {
                    await trx.commit()
               }
               return jobId
          } catch (error) {
               throw new Error('Failed to create SMS job. Please try again later.')
          }
     }

     async getJobById(jobId: number) {
          return this.jobsRepo.findById(jobId)
     }

     async updateJob(jobId: number, dto: Partial<CreateSmsJobDto>) {
          return this.jobsRepo.update(jobId, mapJobDtoToDb(dto))
     }

     async deleteJob(jobId: number) {
          return this.jobsRepo.delete(jobId)
     }

     async getAllJobsPaginated(page: number, count: number) {
          return this.jobsRepo.findAllPaginated(page, count)
     }

     private async processJobData(jobid: number) {
          const job = await this.jobsRepo.findById(jobid)
          if (!job) {
               return
          }
          const { templateid, custombody, recipientscope, sendtype, scheduledat, status } = job
          if (sendtype === 'scheduled' && scheduledat) {
               await this.processScheduledJob(job)
               return
          }
          if (sendtype === 'immediate' && status !== 'pending') {
               const hasTemplate = templateid !== null && templateid !== undefined
               const hasCustomBody = custombody !== null && custombody !== undefined
               if (!hasTemplate && !hasCustomBody) {
                    return
               }
          }
          const recipients = await this.jobRecipientsRepo.findAllByJob(jobid)
          if (job.recipientscope === 'all') {
               await this.processBatchJob(job)
          } else {
               await this.processSingleOrMultipleJob(job, recipients)
          }
     }

     private async processScheduledJob(job: PrimeSmsJob) {
          const { jobid, templateid, custombody, scheduledat } = job
          const recipients = await this.jobRecipientsRepo.findAllByJob(jobid)
          const smsService = new SmsService()
          const numbers = recipients.map(r => r.phonee164)
          let message: string
          if (custombody) {
               message = custombody
          } else if (templateid && recipients.length === 1) {
               message = recipients[0].personalizedbody
          } else {
               return
          }
          try {
               const result = await smsService.scheduleSms(
                    numbers,
                    message,
                    scheduledat.toISOString()
               )
               if (result.status === 'success') {
                    for (const recipient of recipients) {
                         await this.jobRecipientsRepo.update(recipient.recid, {
                              deliverystatus: 'queued'
                         })
                    }
                    await this.jobsRepo.update(job.jobid, { status: 'processing' })
               }
          } catch (err) { }
     }

     private async processSingleOrMultipleJob(job: PrimeSmsJob, recipients: any[]) {
          const smsService = new SmsService()
          const isScheduled = job.sendtype === 'scheduled' && job.scheduledat

          const sendOrSchedule = async (phones: string[], message: string, scheduledAt?: Date) => {
               if (isScheduled && scheduledAt) {
                    return await smsService.scheduleSms(phones, message, scheduledAt.toISOString())
               } else {
                    return await smsService.sendSms(phones, message)
               }
          }


          const updateRecipient = async (recipient: any, status: 'sent' | 'failed' | 'queued' | 'retrying', messageid: any) => {
               await this.jobRecipientsRepo.update(recipient.recid, {
                    deliverystatus: status,
                    messageid: messageid
               })
          }

          const updateJobStatus = async (status: 'pending' | 'processing' | 'sent' | 'partialfailed' | 'failed') => {
               await this.jobsRepo.update(job.jobid, { status })
          }

          if (recipients.length === 1) {
               const recipient = recipients[0]
               let message = job.custombody || recipient.personalizedbody
               try {
                    const result = await sendOrSchedule([recipient.phonee164], message, job.scheduledat)
                    if (result.status === 'success' && Array.isArray(result.data) && result.data[0]) {
                         await updateRecipient(recipient, isScheduled ? 'queued' : 'sent', result.data[0].id)
                         await updateJobStatus(isScheduled ? 'processing' : 'sent')
                    }
               } catch (err) { }
          } else if (recipients.length > 1) {
               if (job.custombody) {
                    try {
                         const numbers = recipients.map(r => r.phonee164)
                         const result = await sendOrSchedule(numbers, job.custombody, job.scheduledat)
                         if (result.status === 'success' && Array.isArray(result.data)) {
                              let allSent = true
                              for (const recipient of recipients) {
                                   const sentInfo = result.data.find((d: any) => d.recipient === recipient.phonee164.replace(/^\+/, ''))
                                   await updateRecipient(recipient, isScheduled ? 'queued' : 'sent', sentInfo ? sentInfo.id : null)
                                   if (!sentInfo) allSent = false
                              }
                              if (allSent) {
                                   await updateJobStatus(isScheduled ? 'processing' : 'sent')
                              }
                         }
                    } catch (err) { }
               } else if (job.templateid) {
                    let allSent = true
                    for (const recipient of recipients) {
                         try {
                              const result = await sendOrSchedule([recipient.phonee164], recipient.personalizedbody, job.scheduledat)
                              if (result.status === 'success' && Array.isArray(result.data) && result.data[0]) {
                                   await updateRecipient(recipient, isScheduled ? 'queued' : 'sent', result.data[0].id)
                              } else {
                                   allSent = false
                              }
                         } catch (err) {
                              allSent = false
                         }
                    }
                    if (allSent) {
                         await updateJobStatus(isScheduled ? 'processing' : 'sent')
                    }
               }
          }
     }

     private async processBatchJob(job: PrimeSmsJob) {
          return
     }

     public async processDueScheduledJobs() {
          const now = new Date()
          const dueJobs = await this.jobsRepo.findAllDueScheduledJobs(now)
          for (const job of dueJobs) {
               const recipients = await this.jobRecipientsRepo.findAllByJob(job.jobid)
               await this.processSingleOrMultipleJob(job, recipients)
          }
     }
}
