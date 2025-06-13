export interface IControlParameter {
    id?: string;
    controlMaterialId: string;
    parameter: string;
    value: number;
    unit: string;
    standardDeviation?: number;
    warningLimit?: number;
    actionLimit?: number;
    validationNotes?: string;
    createdby: number;
    updatedby: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IControlParameterUpdate extends Partial<Omit<IControlParameter, 'id' | 'controlMaterialId' | 'createdAt' | 'updatedAt'>> {}

export interface IControlParameterWithMaterial extends IControlParameter {
    materialName?: string;
    lotNumber?: string;
}