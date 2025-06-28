"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.services = void 0;
const SmsJobsService_1 = require("./SmsJobsService");
const PlaceholderService_1 = require("./PlaceholderService");
const SmsPlaceholderRulesService_1 = require("./SmsPlaceholderRulesService");
const SmsTemplatesService_1 = require("./SmsTemplatesService");
const SmsJobRecipientsService_1 = require("./SmsJobRecipientsService");
const SmsCategoryMappingsService_1 = require("./SmsCategoryMappingsService");
const SmsEventsService_1 = require("./SmsEventsService");
const SmsEventTemplatesService_1 = require("./SmsEventTemplatesService");
exports.services = {
    SmsJobsService: SmsJobsService_1.SmsJobsService,
    PlaceholderService: PlaceholderService_1.PlaceholderService,
    SmsPlaceholderRulesService: SmsPlaceholderRulesService_1.SmsPlaceholderRulesService,
    SmsTemplatesService: SmsTemplatesService_1.SmsTemplatesService,
    SmsJobRecipientsService: SmsJobRecipientsService_1.SmsJobRecipientsService,
    SmsCategoryMappingsService: SmsCategoryMappingsService_1.SmsCategoryMappingsService,
    SmsEventsService: SmsEventsService_1.SmsEventsService,
    SmsEventTemplatesService: SmsEventTemplatesService_1.SmsEventTemplatesService,
};
