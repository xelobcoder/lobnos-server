
import { Request, Response } from 'express';
import LoggingCriticalValueAlertRepository from '../../models/creator/Repo/loggingCriticalValueAlertRepository';
import { TrackValuesAlertClass } from '../../models/creator/TrackValuesAlertClass';

export const markLoggingCriticalValueAlertAsSeen = async (req: Request, res: Response) => {
     try {
          const tenantId = Number(req.query.tenantId);
          const crkeyId = Number(req.params.id);
          const { employeeId } = req.body;
          if (!employeeId) {
               return res.status(400).json({ error: 'employeeId is required in body' });
          }
          const repo = new LoggingCriticalValueAlertRepository(tenantId);
          const updated = await repo.markAsSeen(crkeyId, employeeId);
          res.json({ status: updated > 0 ? true : false });
     } catch (error: any) {
          res.status(500).json({ error: 'Failed to mark alert as seen' });
     }
};


export const getPaginatedLoggingCriticalValueAlerts = async (req: Request, res: Response) => {
     try {
          const tenantId = Number(req.query.tenantId);
          const page = Number(req.query.page) || 1;
          const limit = Number(req.query.count) || 10;
          const sortby = req.query.sortby === 'ASC' ? 'ASC' : 'DESC';
          const status = req.query.status as "seen" | "unseen" | "all";
          const repo = new LoggingCriticalValueAlertRepository(tenantId);

          if (status == "unseen") {
               const alerts = await repo.findAllPaginated(page, limit, sortby, { isSeen: 0 });
               return res.json(alerts);
          } else if (status == "seen") {
               const alerts = await repo.findAllPaginated (page, limit, sortby,{ isSeen: 1 });
               return res.json(alerts);
          } else {
               const alerts = await repo.findAllPaginated(page, limit, sortby);
               return res.json(alerts);
          }
          
     } catch (error: any) {
          res.status(500).json({ error: 'Failed to fetch paginated alerts', details: error.message });
     }
};



export const getCriticalDetails = async (req: Request, res: Response) => {
     try {
          const tenantId = Number(req.query.tenantId);
          const crkeyId = Number(req.params.crKeyId);
          const data = await new TrackValuesAlertClass(tenantId).getCriticalDetailsWithAscension(crkeyId);
          res.json(data);
     } catch (error: any) {
          res.status(500).json({ error: 'Failed to fetch critical details', details: error.message });
     }
}



export const createLoggingCriticalValueAlert = async (req: Request, res: Response) => {
     try {
          const tenantId = Number(req.query.tenantId);
          const repo = new LoggingCriticalValueAlertRepository(tenantId);
          const id = await repo.createAlert(req.body);
          res.status(201).json({ id });
     } catch (error: any) {
          res.status(500).json({ error: 'Failed to create alert', details: error.message });
     }
};

export const getLoggingCriticalValueAlertById = async (req: Request, res: Response) => {
     try {
          const tenantId = Number(req.query.tenantId);
          const repo = new LoggingCriticalValueAlertRepository(tenantId);
          const alert = await repo.findById(Number(req.params.id));
          if (!alert) return res.status(404).json({ error: 'Not found' });
          res.json(alert);
     } catch (error: any) {
          res.status(500).json({ error: 'Failed to fetch alert', details: error.message });
     }
};


export const getLoggingCriticalValueAlertsPaginated = async (req: Request, res: Response) => {
     try {
          const tenantId = Number(req.query.tenantId);
          const repo = new LoggingCriticalValueAlertRepository(tenantId);
          const page = req.query.page ? Number(req.query.page) : 1;
          const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 20;
          const sortby = req.query.sortby === 'ASC' ? 'ASC' : 'DESC';
          const filters = {
               testid: req.query.testid ? Number(req.query.testid) : undefined,
               ascensionid: req.query.ascensionid ? Number(req.query.ascensionid) : undefined,
               billingid: req.query.billingid ? Number(req.query.billingid) : undefined,
          };
          const result = await repo.findAllPaginated(page, pageSize, sortby, filters);
          res.json(result);
     } catch (error: any) {
          res.status(500).json({ error: 'Failed to fetch paginated alerts', details: error.message });
     }
};

export const updateLoggingCriticalValueAlert = async (req: Request, res: Response) => {
     try {
          const tenantId = Number(req.query.tenantId);
          const repo = new LoggingCriticalValueAlertRepository(tenantId);
          const updated = await repo.update(Number(req.params.id), req.body);
          res.json({ updated });
     } catch (error: any) {
          res.status(500).json({ error: 'Failed to update alert', details: error.message });
     }
};

export const deleteLoggingCriticalValueAlert = async (req: Request, res: Response) => {
     try {
          const tenantId = Number(req.query.tenantId);
          const repo = new LoggingCriticalValueAlertRepository(tenantId);
          const deleted = await repo.delete(Number(req.params.id));
          res.json({ deleted });
     } catch (error: any) {
          res.status(500).json({ error: 'Failed to delete alert', details: error.message });
     }
};


export const getAllLoggingCriticalValueAlerts = async (req: Request, res: Response) => {
     try {
          const tenantId = Number(req.query.tenantId);
          const repo = new LoggingCriticalValueAlertRepository(tenantId);
          const alerts = await repo.findAll();
          res.json(alerts);
     } catch (err: any) {
          res.status(500).json({ error: 'Failed to fetch alerts', details: err.message });
     }
}