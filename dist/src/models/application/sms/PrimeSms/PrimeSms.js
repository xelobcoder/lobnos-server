"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrimeSms = void 0;
const PrimeSmsTemplatesRepo_1 = require("../repositories/PrimeSmsTemplatesRepo");
const PrimeSmsJobsRepo_1 = require("../repositories/PrimeSmsJobsRepo");
const PrimeSmsJobRecipientsRepo_1 = require("../repositories/PrimeSmsJobRecipientsRepo");
const PrimeSmsCategoryMappingsRepo_1 = require("../repositories/PrimeSmsCategoryMappingsRepo");
const PrimeSmsPlaceholderRulesRepo_1 = require("../repositories/PrimeSmsPlaceholderRulesRepo");
const PrimeSmsEventsRepo_1 = require("../repositories/PrimeSmsEventsRepo");
const PrimeSmsEventTemplatesRepo_1 = require("../repositories/PrimeSmsEventTemplatesRepo");
class PrimeSms {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.templates = new PrimeSmsTemplatesRepo_1.PrimeSmsTemplatesRepo(tenantId);
        this.jobs = new PrimeSmsJobsRepo_1.PrimeSmsJobsRepo(tenantId);
        this.recipients = new PrimeSmsJobRecipientsRepo_1.PrimeSmsJobRecipientsRepo(tenantId);
        this.categoryMappings = new PrimeSmsCategoryMappingsRepo_1.PrimeSmsCategoryMappingsRepo(tenantId);
        this.placeholderRules = new PrimeSmsPlaceholderRulesRepo_1.PrimeSmsPlaceholderRulesRepo(tenantId);
        this.events = new PrimeSmsEventsRepo_1.PrimeSmsEventsRepo(tenantId);
        this.eventTemplates = new PrimeSmsEventTemplatesRepo_1.PrimeSmsEventTemplatesRepo(tenantId);
    }
}
exports.PrimeSms = PrimeSms;
