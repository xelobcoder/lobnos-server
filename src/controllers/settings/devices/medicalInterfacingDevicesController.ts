import { Request, Response } from "express";
import MedicalInterfacingDevicesRepository, { IMedicalInterfacingDevice } from "../../../models/settings/devices/MedicalInterfacingDevicesRepository";

export async function getAllDevicesHandler(req: Request, res: Response) {
     try {
          const tenantId = Number(req.query.tenantId) || 1;
          const repo = new MedicalInterfacingDevicesRepository(tenantId);
          const devices = await repo.getAllDevices();
          res.json(devices);
     } catch (err: any) {
          res.status(500).json({ error: err.message });
     }
}

export async function getDeviceByIdHandler(req: Request, res: Response) {
     try {
          const tenantId = Number(req.query.tenantId) || 1;
          const repo = new MedicalInterfacingDevicesRepository(tenantId);
          const device = await repo.getDeviceById(Number(req.params.id));
          if (!device) return res.status(404).json({ error: "Device not found" });
          res.json(device);
     } catch (err: any) {
          res.status(500).json({ error: err.message });
     }
}

export async function createDeviceHandler(req: Request, res: Response) {
     try {
          const tenantId = Number(req.query.tenantId) || 1;
          const repo = new MedicalInterfacingDevicesRepository(tenantId);
          const id = await repo.createDevice(req.body as IMedicalInterfacingDevice);
          res.status(201).json({ id , status: parseInt(id.toString()) > 0 ? 'success' : 'failed'});
     } catch (err: any) {
          res.status(500).json({ error: err.message });
     }
}

export async function updateDeviceHandler(req: Request, res: Response) {
     try {
          const tenantId = Number(req.query.tenantId) || 1;
          const repo = new MedicalInterfacingDevicesRepository(tenantId);
          const updated = await repo.updateDevice(Number(req.params.id), req.body);
          res.json({ updated , status : parseInt(updated.toString()) > 0 ? 'success' : 'failed'});
     } catch (err: any) {
          res.status(500).json({ error: err.message });
     }
}

export async function deleteDeviceHandler(req: Request, res: Response) {
     try {
          const tenantId = Number(req.query.tenantId) || 1;
          const repo = new MedicalInterfacingDevicesRepository(tenantId);
          const deleted = await repo.deleteDevice(Number(req.params.id));
          res.json({ deleted, status:  parseInt(deleted.toString()) > 0 ? 'success' : 'failed' });
     } catch (err: any) {
          res.status(500).json({ error: err.message });
     }
}


