export interface TestConditionDefinitionEntity {
     id: number;
     conditionName: string;
     testId: number;
     createdBy: number;
     updatedBy: number | null;
     createdOn: Date;
     updatedOn: Date;
}