import nodemailer from 'nodemailer';
import { IEmailProvider } from '../../interfaces/IEmailProvider';
import { EmailDispatchResult, ResolvedEmailJob } from '../../types/EmailModels';

interface SmtpConfig {
     host: string;
     port: number;
     secure: boolean;
     username: string;
     password: string;
}

export class SmtpEmailProvider implements IEmailProvider {
     private transporter;

     constructor(private config: SmtpConfig) {
          this.transporter = nodemailer.createTransport({
               host: config.host,
               port: config.port,
               secure: config.secure,
               auth: {
                    user: config.username,
                    pass: config.password,
               },
          });
     }

     async send(job: ResolvedEmailJob): Promise<EmailDispatchResult> {
          try {
               const info = await this.transporter.sendMail({
                    from: `"${job.fromName}" <${job.fromEmail}>`,
                    to: job.to,
                    cc: job.cc,
                    bcc: job.bcc,
                    subject: job.subject,
                    html: job.htmlBody,
                    text: job.plainTextBody,
                    attachments: job.attachments.map((attachment) => ({
                         filename: attachment.filename,
                         path: attachment.path,
                         contentType: attachment.contentType,
                    })),
               });

               return {
                    success: true,
                    providerMessageId: info.messageId,
                    responsePayload: {
                         accepted: info.accepted,
                         rejected: info.rejected,
                         response: info.response,
                    },
               };
          } catch (error: any) {
               return {
                    success: false,
                    failureReason: error?.message || 'SMTP delivery failed',
               };
          }
     }

     async testConnection(): Promise<boolean> {
          return this.transporter.verify();
     }
}
