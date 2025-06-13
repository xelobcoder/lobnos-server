import { Request, Response } from 'express';
import TestCreationMultipleConditionsClass from '../../models/operations/testCreationMultipleCondtionsClass';
import { responseError, rowAffected } from '../../hooks/helper';

export const createTestConditionDefinition = async (req: Request, res: Response) => {
     try {
          const { conditionName, testid } = req.body;
          const tenantId = req.query.tenantId as string;
          const instance = new TestCreationMultipleConditionsClass();
          const result = await instance.createTestConditionDefinition(Number(tenantId), conditionName, testid);
          const status = rowAffected(result);
          res.status(201).json({ status, conditionId: result?.insertId });
     } catch (error: any) {
          responseError(res);
     }
};

export const getTestConditionDefinition = async (req: Request, res: Response) => {
     try {
          const { id } = req.params;
          const tenantId = req.query.tenantId as string;
          const instance = new TestCreationMultipleConditionsClass();
          const rows = await instance.getTestConditionDefinitionById(Number(tenantId), Number(id));
          res.status(200).json(rows);
     } catch (error: any) {
          responseError(res);
     }
};

export const updateTestConditionDefinition = async (req: Request, res: Response) => {
     try {
          const { id } = req.params;
          const { conditionName, testid } = req.body;
          const tenantId = req.query.tenantId as string;
          const instance = new TestCreationMultipleConditionsClass();
          const result = await instance.updateTestConditionDefinition(Number(tenantId), Number(id), conditionName, testid);
          res.status(200).json({ status: result });
     } catch (error: any) {
          responseError(res);
     }
};

export const deleteTestConditionDefinition = async (req: Request, res: Response) => {
     try {
          const { id } = req.params;
          const tenantId = req.query.tenantId as string;
          const instance = new TestCreationMultipleConditionsClass();
          const result = await instance.deleteTestConditionDefinition(Number(tenantId), Number(id));
          res.status(200).json({ status: result });
     } catch (error: any) {
          responseError(res);
     }
};

export const createTestCondition = async (req: Request, res: Response) => {
     try {
          const { testid, conditionId, createdBy, fieldConstraints = [] } = req.body;
          const tenantId = req.query.tenantId as string;
          const instance = new TestCreationMultipleConditionsClass();
          const status = await instance.createTestCondition(Number(tenantId), testid, conditionId, fieldConstraints, createdBy);
          res.status(201).json({ status });
     } catch (error: any) {
          console.log(error);
          responseError(res);
     }
};

export const getTestDefinitionConditionsHandler = async (req: Request, res: Response) => {
     try {
          const { conditionId } = req.params;
          const tenantId = req.query.tenantId as string;
          if (!isNaN(parseInt(conditionId.toString()))) {
               const result = await new TestCreationMultipleConditionsClass().getTestDefinitionConditions(Number(tenantId), parseInt(conditionId.toString()));
               res.status(201).json({ result });
          }
     } catch (error: any) {
          console.log(error);
          responseError(res);
     }
};

export const getTestCondition = async (req: Request, res: Response) => {
     try {
          const { id } = req.params;
          const tenantId = req.query.tenantId as string;
          const instance = new TestCreationMultipleConditionsClass();
          const rows = await instance.getTestConditionById(Number(tenantId), Number(id));
          res.status(200).json(rows);
     } catch (error: any) {
          responseError(res);
     }
};

export const updateTestCondition = async (req: Request, res: Response) => {
     try {
          const { id } = req.params;
          const { testId, parameter, conditionId, target, inRange, createdBy } = req.body;
          const tenantId = req.query.tenantId as string;
          const instance = new TestCreationMultipleConditionsClass();
          const result = await instance.updateTestCondition(Number(tenantId), Number(id), testId, parameter, conditionId, target, inRange, createdBy);
          res.status(200).json(result);
     } catch (error: any) {
          responseError(res);
     }
};

export const deleteTestCondition = async (req: Request, res: Response) => {
     try {
          const { id } = req.params;
          const tenantId = req.query.tenantId as string;
          const instance = new TestCreationMultipleConditionsClass();
          const result = await instance.deleteTestCondition(Number(tenantId), Number(id));
          res.status(200).json(result);
     } catch (error: any) {
          responseError(res);
     }
};

export const getTestDefinitionsTestId = async (req: Request, res: Response) => {
     try {
          const { testid } = req.params;
          const tenantId = req.query.tenantId as string;
          const result = await TestCreationMultipleConditionsClass.getTestDefinitions(Number(tenantId), parseInt(testid.toString()));
          res.status(200).json(result);
     } catch (error: any) {
          responseError(res);
     }
};
