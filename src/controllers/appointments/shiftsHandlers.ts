import { Request, Response } from "express";
import ShiftService from "../../models/appointments/shfitsServices";

export const createShiftHandler = async (req: Request, res: Response) => {
     try {
          const tenantId: number = parseInt(req.query.tenant as string, 10);
          const shift = req.body;
          const newShift = await ShiftService.createShift(tenantId, shift);
          res.status(201).json(newShift);
     } catch (error: any) {
          res.status(500).json({ error: error.message });
     }
};

export const getAllShiftsHandler = async (req: Request, res: Response) => {
     try {
          const tenantId: number = parseInt(req.query.tenant as string, 10);
          const shifts = await ShiftService.getAllShifts(tenantId);
          res.status(200).json(shifts);
     } catch (error: any) {
          res.status(500).json({ error: error.message });
     }
};

export const getShiftByIdHandler = async (req: Request, res: Response) => {
     try {
          const tenantId: number = parseInt(req.query.tenant as string, 10);
          const { id } = req.params;
          const shift = await ShiftService.getShiftById(tenantId, Number(id));
          if (!shift) {
               return res.status(404).json({ message: "Shift not found" });
          }
          res.status(200).json(shift);
     } catch (error: any) {
          res.status(500).json({ error: error.message });
     }
};

export const updateShiftHandler = async (req: Request, res: Response) => {
     try {
          const tenantId: number = parseInt(req.query.tenant as string, 10);
          const { id } = req.params;
          const updates = req.body;
          const updatedShift = await ShiftService.updateShift(tenantId, Number(id), updates);
          if (!updatedShift) {
               return res.status(404).json({ message: "Shift not found or not updated" });
          }
          res.status(200).json(updatedShift);
     } catch (error: any) {
          res.status(500).json({ error: error.message });
     }
};

export const deleteShiftHandler = async (req: Request, res: Response) => {
     try {
          const tenantId: number = parseInt(req.query.tenant as string, 10);
          const { id } = req.params;
          const deletedCount = await ShiftService.deleteShift(tenantId, Number(id));
          if (deletedCount === 0) {
               return res.status(404).json({ message: "Shift not found" });
          }
          res.status(200).json({ message: "Shift deleted successfully" });
     } catch (error: any) {
          res.status(500).json({ error: error.message });
     }
};

export const loadDefaultShiftsHandler = async (req: Request, res: Response) => {
     try {
          const tenantId: number = parseInt(req.query.tenant as string, 10);
          await ShiftService.loadDefaultShifts(tenantId);
          res.status(200).json({ message: "Default shifts loaded" });
     } catch (error: any) {
          res.status(500).json({ error: error.message });
     }
};
