"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ControlParameterRepository = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
class ControlParameterRepository {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async create(parameterData) {
        try {
            const conn = await this.connection;
            // Delete existing parameters for this control material that aren't in the new set
            if (parameterData.length > 0) {
                const controlMaterialId = parameterData[0].controlMaterialId;
                const newParameters = parameterData.map(p => p.parameter);
                await conn('control_parameters')
                    .where({ controlMaterialId })
                    .whereNotIn('parameter', newParameters)
                    .delete();
            }
            // Then proceed with upsert operation
            const results = await Promise.all(parameterData.map(async (param) => {
                const { id } = param, paramWithoutId = __rest(param, ["id"]);
                const existing = await conn('control_parameters')
                    .where({
                    controlMaterialId: param.controlMaterialId,
                    parameter: param.parameter
                })
                    .first();
                if (existing) {
                    await conn('control_parameters')
                        .where({ id: existing.id })
                        .update(paramWithoutId);
                    return existing.id;
                }
                else {
                    const [newId] = await conn('control_parameters')
                        .insert(paramWithoutId)
                        .returning('id');
                    return newId;
                }
            }));
            return results;
        }
        catch (error) {
            console.error('Control parameter bulk creation error:', error);
            throw error;
        }
    }
    async update(controlId, updates) {
        try {
            const conn = await this.connection;
            const results = await Promise.all(updates.map(update => conn('control_parameters')
                .where({ controlMaterialId: controlId, parameter: update.parameter })
                .update(update)));
            return results.some(result => result > 0);
        }
        catch (error) {
            console.error('Control parameter bulk update error:', error);
            throw error;
        }
    }
    async findById(id) {
        try {
            const conn = await this.connection;
            return await conn('control_parameters')
                .where({ id })
                .first();
        }
        catch (error) {
            console.error('Control parameter find error:', error);
            throw error;
        }
    }
    async findByControlId(controlMaterialId) {
        try {
            const conn = await this.connection;
            return await conn('control_parameters')
                .where({ controlMaterialId })
                .orderBy('parameter', 'asc');
        }
        catch (error) {
            console.error('Control parameter find by material error:', error);
            throw error;
        }
    }
    async findAllPaginated(page = 1, limit = 10) {
        try {
            const conn = await this.connection;
            const offset = (page - 1) * limit;
            const [total] = await conn('control_parameters')
                .count('id as count');
            const data = await conn('control_parameters')
                .leftJoin('control_materials', 'control_parameters.controlMaterialId', 'control_materials.id')
                .select('control_parameters.*', 'control_materials.name as materialName', 'control_materials.lotNumber')
                .orderBy('control_parameters.createdAt', 'desc')
                .limit(limit)
                .offset(offset);
            return {
                data,
                total: total.count,
                page,
                totalPages: Math.ceil(total.count / limit)
            };
        }
        catch (error) {
            console.error('Control parameter paginated find error:', error);
            throw error;
        }
    }
    async delete(id) {
        try {
            const conn = await this.connection;
            return await conn('control_parameters')
                .where({ id })
                .delete();
        }
        catch (error) {
            console.error('Control parameter delete error:', error);
            throw error;
        }
    }
    async searchByParameter(searchTerm) {
        try {
            const conn = await this.connection;
            return await conn('control_parameters')
                .leftJoin('control_materials', 'control_parameters.controlMaterialId', 'control_materials.id')
                .select('control_parameters.*', 'control_materials.name as materialName', 'control_materials.lotNumber')
                .where('control_parameters.parameter', 'like', `%${searchTerm}%`)
                .orderBy('control_parameters.parameter', 'asc');
        }
        catch (error) {
            console.error('Control parameter search error:', error);
            throw error;
        }
    }
}
exports.ControlParameterRepository = ControlParameterRepository;
exports.default = ControlParameterRepository;
