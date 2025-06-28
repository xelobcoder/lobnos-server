import { PrimeSmsTemplatesRepo } from "../repositories/PrimeSmsTemplatesRepo";
import { PrimeSmsJobsRepo } from "../repositories/PrimeSmsJobsRepo";
import { PrimeSmsJobRecipientsRepo } from "../repositories/PrimeSmsJobRecipientsRepo";
import { PrimeSmsCategoryMappingsRepo } from "../repositories/PrimeSmsCategoryMappingsRepo";
import { PrimeSmsPlaceholderRulesRepo } from "../repositories/PrimeSmsPlaceholderRulesRepo";
import { PrimeSmsEventsRepo } from "../repositories/PrimeSmsEventsRepo";
import { PrimeSmsEventTemplatesRepo } from "../repositories/PrimeSmsEventTemplatesRepo";

export class PrimeSms {
     public templates: PrimeSmsTemplatesRepo;
     public jobs: PrimeSmsJobsRepo;
     public recipients: PrimeSmsJobRecipientsRepo;
     public categoryMappings: PrimeSmsCategoryMappingsRepo;
     public placeholderRules: PrimeSmsPlaceholderRulesRepo;
     public events: PrimeSmsEventsRepo;
     public eventTemplates: PrimeSmsEventTemplatesRepo;

     constructor(public tenantId: number) {
          this.templates = new PrimeSmsTemplatesRepo(tenantId);
          this.jobs = new PrimeSmsJobsRepo(tenantId);
          this.recipients = new PrimeSmsJobRecipientsRepo(tenantId);
          this.categoryMappings = new PrimeSmsCategoryMappingsRepo(tenantId);
          this.placeholderRules = new PrimeSmsPlaceholderRulesRepo(tenantId);
          this.events = new PrimeSmsEventsRepo(tenantId);
          this.eventTemplates = new PrimeSmsEventTemplatesRepo(tenantId);
     }
}
