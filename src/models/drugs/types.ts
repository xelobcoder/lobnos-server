export interface drugCategoryInformation {
    id?: number;
    categoryName: string;
    description?: string;
    createdBy: number
}


export const enum DrugInfo {
    catExist = 'Drug Category Already Exist'
}