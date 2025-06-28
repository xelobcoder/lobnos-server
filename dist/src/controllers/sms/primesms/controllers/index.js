"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrimeSmsControllerClasses = void 0;
const SmsJobsController_1 = require("./SmsJobsController");
const SmsTemplatesController_1 = require("./SmsTemplatesController");
const SmsJobRecipientsController_1 = require("./SmsJobRecipientsController");
const SmsCategoryMappingsController_1 = require("./SmsCategoryMappingsController");
const SmsPlaceholderRulesController_1 = require("./SmsPlaceholderRulesController");
const SmsEventsController_1 = require("./SmsEventsController");
const SmsEventTemplatesController_1 = require("./SmsEventTemplatesController");
exports.PrimeSmsControllerClasses = {
    SmsJobsController: SmsJobsController_1.SmsJobsController,
    SmsTemplatesController: SmsTemplatesController_1.SmsTemplatesController,
    SmsJobRecipientsController: SmsJobRecipientsController_1.SmsJobRecipientsController,
    SmsCategoryMappingsController: SmsCategoryMappingsController_1.SmsCategoryMappingsController,
    SmsPlaceholderRulesController: SmsPlaceholderRulesController_1.SmsPlaceholderRulesController,
    SmsEventsController: SmsEventsController_1.SmsEventsController,
    SmsEventTemplatesController: SmsEventTemplatesController_1.SmsEventTemplatesController,
};
