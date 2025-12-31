"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsCategoryMappingsController = void 0;
const CreateSmsCategoryMappingDto_1 = require("../../../models/application/sms/dtos/CreateSmsCategoryMappingDto");
class SmsCategoryMappingsController {
    constructor(mappingsService) {
        this.mappingsService = mappingsService;
    }
    async create(req, res) {
        try {
            const dto = CreateSmsCategoryMappingDto_1.CreateSmsCategoryMappingSchema.parse(req.body);
            const id = await this.mappingsService.createMapping(dto);
            res.status(201).json({ id });
        }
        catch (err) {
            res.status(400).json({ error: err });
        }
    }
    async getById(req, res) {
        const mapping = await this.mappingsService.getMappingById(Number(req.params.id));
        if (!mapping)
            return res.status(404).json({ error: 'Not found' });
        res.json(mapping);
    }
    async update(req, res) {
        try {
            const partialSchema = CreateSmsCategoryMappingDto_1.CreateSmsCategoryMappingSchema.partial();
            const dto = partialSchema.parse(req.body);
            const updated = await this.mappingsService.updateMapping(Number(req.params.id), dto);
            res.json({ updated });
        }
        catch (err) {
            res.status(400).json({ error: err });
        }
    }
    async delete(req, res) {
        const deleted = await this.mappingsService.deleteMapping(Number(req.params.id));
        res.json({ deleted });
    }
    async getAll(req, res) {
        const mappings = await this.mappingsService.getAllMappings();
        res.json(mappings);
    }
    async getCategoriesWithPlaceholders(req, res) {
        const result = await this.mappingsService.getCategoriesWithPlaceholders();
        res.json(result);
    }
}
exports.SmsCategoryMappingsController = SmsCategoryMappingsController;
