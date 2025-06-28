"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsPlaceholderRulesController = void 0;
const CreateSmsPlaceholderRuleDto_1 = require("../dtos/CreateSmsPlaceholderRuleDto");
class SmsPlaceholderRulesController {
    constructor(rulesService) {
        this.rulesService = rulesService;
    }
    async create(req, res) {
        try {
            const dto = CreateSmsPlaceholderRuleDto_1.CreateSmsPlaceholderRuleSchema.parse(req.body);
            const id = await this.rulesService.createRule(dto);
            res.status(201).json({ id });
        }
        catch (err) {
            res.status(400).json({ error: err });
        }
    }
    async getById(req, res) {
        const rule = await this.rulesService.getRuleById(Number(req.params.id));
        if (!rule)
            return res.status(404).json({ error: 'Not found' });
        res.json(rule);
    }
    async update(req, res) {
        try {
            const partialSchema = CreateSmsPlaceholderRuleDto_1.CreateSmsPlaceholderRuleSchema.partial();
            const dto = partialSchema.parse(req.body);
            const updated = await this.rulesService.updateRule(Number(req.params.id), dto);
            res.json({ updated });
        }
        catch (err) {
            res.status(400).json({ error: err });
        }
    }
    async delete(req, res) {
        const deleted = await this.rulesService.deleteRule(Number(req.params.id));
        res.json({ deleted });
    }
    async getAll(req, res) {
        const rules = await this.rulesService.getAllRules();
        res.json(rules);
    }
}
exports.SmsPlaceholderRulesController = SmsPlaceholderRulesController;
