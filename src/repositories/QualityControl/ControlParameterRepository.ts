import KnexConnection from "../../database/KnexConnections";
import { IControlParameter, IControlParameterUpdate, IControlParameterWithMaterial } from "../../schemas/ControlParameterSchema";
import { v4 as uuidv4 } from 'uuid';
interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    totalPages: number;
}

export class ControlParameterRepository {
    private tenantId: number;
    private connection: any;

    constructor(tenantId: number) {
        this.tenantId = tenantId;
        this.connection = KnexConnection(tenantId);
    }

    async create(parameterData: IControlParameter[]): Promise<number[]> {
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
            const results = await Promise.all(
                parameterData.map(async param => {
                    const { id, ...paramWithoutId } = param;
                    const existing = await conn('control_parameters')
                        .where({
                            controlMaterialId: param.controlMaterialId,
                            parameter: param.parameter
                        })
                        .first();

                    if (existing) {
                        await conn('control_parameters')
                            .where({ id: existing.id })
                            .update({
                                ...paramWithoutId, createdAt: new Date(paramWithoutId.createdAt),
                                updatedAt: new Date(paramWithoutId.updatedAt)
                            });
                        return existing.id;
                    } else {
                        const generatedId = uuidv4()
                        const [newId] = await conn('control_parameters')
                            .insert({ ...paramWithoutId, id: generatedId, updatedby: paramWithoutId.createdby })
                            .returning('id');
                        return newId;
                    }
                })
            );
            return results;
        } catch (error) {
            console.error('Control parameter bulk creation error:', error);
            throw error;
        }
    }

    async update(controlId: string, updates: IControlParameter[]): Promise<boolean> {
        try {
            const conn = await this.connection;
            const results = await Promise.all(
                updates.map(update =>
                    conn('control_parameters')
                        .where({
                            controlMaterialId: controlId,
                            parameter: update.parameter

                        })
                        .update({
                            ...update, createdAt: new Date(update.createdAt),
                            updatedAt: new Date(update.updatedAt)
                        })
                )
            );
            return results.some(result => result > 0);
        } catch (error) {
            console.error('Control parameter bulk update error:', error);
            throw error;
        }
    }

    async findById(id: string): Promise<IControlParameter | undefined> {
        try {
            const conn = await this.connection;
            return await conn('control_parameters')
                .where({ id })
                .first();
        } catch (error) {
            console.error('Control parameter find error:', error);
            throw error;
        }
    }

    async findByControlId(controlMaterialId: string): Promise<IControlParameter[]> {
        try {
            const conn = await this.connection;
            return await conn('control_parameters')
                .where({ controlMaterialId })
                .orderBy('parameter', 'asc');
        } catch (error) {
            console.error('Control parameter find by material error:', error);
            throw error;
        }
    }

    async findAllPaginated(
        page: number = 1,
        limit: number = 10
    ): Promise<PaginatedResponse<IControlParameterWithMaterial>> {
        try {
            const conn = await this.connection;
            const offset = (page - 1) * limit;

            const [total] = await conn('control_parameters')
                .count('id as count');

            const data = await conn('control_parameters')
                .leftJoin('control_materials', 'control_parameters.controlMaterialId', 'control_materials.id')
                .select(
                    'control_parameters.*',
                    'control_materials.name as materialName',
                    'control_materials.lotNumber'
                )
                .orderBy('control_parameters.createdAt', 'desc')
                .limit(limit)
                .offset(offset);

            return {
                data,
                total: total.count,
                page,
                totalPages: Math.ceil(total.count / limit)
            };
        } catch (error) {
            console.error('Control parameter paginated find error:', error);
            throw error;
        }
    }

    async delete(id: string): Promise<number> {
        try {
            const conn = await this.connection;
            return await conn('control_parameters')
                .where({ id })
                .delete();
        } catch (error) {
            console.error('Control parameter delete error:', error);
            throw error;
        }
    }

    async searchByParameter(searchTerm: string): Promise<IControlParameterWithMaterial[]> {
        try {
            const conn = await this.connection;
            return await conn('control_parameters')
                .leftJoin('control_materials', 'control_parameters.controlMaterialId', 'control_materials.id')
                .select(
                    'control_parameters.*',
                    'control_materials.name as materialName',
                    'control_materials.lotNumber'
                )
                .where('control_parameters.parameter', 'like', `%${searchTerm}%`)
                .orderBy('control_parameters.parameter', 'asc');
        } catch (error) {
            console.error('Control parameter search error:', error);
            throw error;
        }
    }
}

export default ControlParameterRepository;