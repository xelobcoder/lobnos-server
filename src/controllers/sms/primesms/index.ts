// Type for controller INSTANCES
export type PrimeSmsControllerInstances = {
     SmsJobsController: InstanceType<typeof SmsJobsController>;
     SmsTemplatesController: InstanceType<typeof SmsTemplatesController>;
     SmsJobRecipientsController: InstanceType<typeof SmsJobRecipientsController>;
     SmsCategoryMappingsController: InstanceType<typeof SmsCategoryMappingsController>;
     SmsPlaceholderRulesController: InstanceType<typeof SmsPlaceholderRulesController>;
     SmsEventsController: InstanceType<typeof SmsEventsController>;
     SmsEventTemplatesController: InstanceType<typeof SmsEventTemplatesController>;
};
import { SmsJobsController } from './SmsJobsController';
import { SmsTemplatesController } from './controllers/SmsTemplatesController';
import { SmsJobRecipientsController } from './SmsJobRecipientsController';
import { SmsCategoryMappingsController } from './SmsCategoryMappingsController';
import { SmsPlaceholderRulesController } from './controllers/SmsPlaceholderRulesController';
import { SmsEventsController } from './SmsEventsController';
import { SmsEventTemplatesController } from './SmsEventTemplatesController';


export const PrimeSmsControllerClasses = {
     SmsJobsController,
     SmsTemplatesController,
     SmsJobRecipientsController,
     SmsCategoryMappingsController,
     SmsPlaceholderRulesController,
     SmsEventsController,
     SmsEventTemplatesController,
};
export type PrimeSmsControllerClasses = typeof PrimeSmsControllerClasses;