import { EmailDispatchResult, ResolvedEmailJob } from '../types/EmailModels';

export interface IEmailProvider {
     send(job: ResolvedEmailJob): Promise<EmailDispatchResult>;
     testConnection(): Promise<boolean>;
}
