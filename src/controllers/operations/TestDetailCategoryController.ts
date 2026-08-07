import { Request, Response } from "express";
import TestDetailCategory from "../../models/operations/testFieldsCategoryClass";

export class TestDetailCategoryController {

     static async create(req: Request, res: Response) {
          const tenantId = parseInt(req.query.tenantId as string);
          const data = req.body;
          const result = await TestDetailCategory.create(tenantId, data);
          res.status(201).json({ message: "Category created successfully", result });
     }

     static async getAll(req: Request, res: Response) {
          const tenantId = parseInt(req.query.tenantId as string);
          const { limit, offset, createdby } = req.query;
          const result = await TestDetailCategory.getAll(tenantId, {
               limit: Number(limit) || 10,
               offset: Number(offset) || 0,
               createdby: createdby ? String(createdby) : null,
          });
          res.status(200).json(result);
     }

     static async getById(req: Request, res: Response) {
          const tenantId = parseInt(req.query.tenantId as string);
          const { id } = req.params;
          const result = await TestDetailCategory.getById(tenantId, Number(id));
          if (!result) {
               res.status(404).json({ message: "Category not found" });
          }
          else {
               res.status(200).json(result);
          }
     }

     static async getByTestId(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const testid = req.params.testid;
               const result = await TestDetailCategory.getByTestId(tenantId, Number(testid));
               res.status(200).json(result);
          } catch (error) {
               res.status(500).json({ message: "Internal server error" });
          }
     }

     static async update(req: Request, res: Response) {
          const tenantId = parseInt(req.query.tenantId as string);
          const { id } = req.params;
          const data = req.body;
          const result = await TestDetailCategory.update(tenantId, Number(id), data);
          if (!result) {
               res.status(404).json({ message: "Category not found" });
          } else {
               res.status(200).json({ message: "Category updated successfully" });
          }
     }

     static async softDelete(req: Request, res: Response) {
          const tenantId = parseInt(req.query.tenantId as string);
          const { id } = req.params;
          const result = await TestDetailCategory.softDelete(tenantId, Number(id));
          if (!result) {
               res.status(404).json({ message: "Category not found" });
          } else {
               res.status(200).json({ message: "Category soft deleted successfully" });
          }
     }

     static async restore(req: Request, res: Response) {
          const tenantId = parseInt(req.query.tenantId as string);
          const { id } = req.params;
          const result = await TestDetailCategory.restore(tenantId, Number(id));

          if (!result) {
               res.status(404).json({ message: "Category not found or not deleted" });
          } else {
               res.status(200).json({ message: "Category restored successfully" });
          }
     }

     static async delete(req: Request, res: Response) {
          const tenantId = parseInt(req.query.tenantId as string);
          const { id } = req.params;
          const result = await TestDetailCategory.delete(tenantId, Number(id));

          if (!result) {
               res.status(404).json({ message: "Category not found" });
          } else {
               res.status(200).json({ message: "Category deleted successfully" });
          }
     }
}

export default TestDetailCategoryController;
