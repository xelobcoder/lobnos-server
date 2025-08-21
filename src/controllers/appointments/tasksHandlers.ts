import { Request, Response } from 'express';
import PrimeLimsTabletasksService from '../../models/appointments/tasks';

export const createTask = async (req: Request, res: Response) => {
     try {
          const tenantId: number = parseInt(req.query.tenantId as string, 10);
          const taskService = new PrimeLimsTabletasksService('tasks');
          const newTask = await taskService.create(tenantId, req.body);
          res.status(201).json({ status: typeof newTask === "number" });
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Failed to create task' });
     }
};

export const getTask = async (req: Request, res: Response) => {
     const { id } = req.params;
     try {
          const tenantId: number = parseInt(req.query.tenantId as string, 10);
          const taskService = new PrimeLimsTabletasksService('tasks');
          const task = await taskService.read(tenantId, Number(id));
          if (task) {
               res.status(200).json(task);
          } else {
               res.status(404).json({ error: 'Task not found' });
          }
     } catch (error) {
          res.status(500).json({ error: 'Failed to fetch task' });
     }
};

export const updateTask = async (req: Request, res: Response) => {
     const { id } = req.params;
     try {
          const tenantId: number = parseInt(req.query.tenantId as string, 10);
          const taskService = new PrimeLimsTabletasksService('tasks');
          const updatedTask = await taskService.update(tenantId, Number(id), req.body);
          if (updatedTask) {
               res.status(200).json({ status: updatedTask });
          } else {
               res.status(404).json({ status: false, error: 'Task not found' });
          }
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Failed to update task' });
     }
};

export const deleteTask = async (req: Request, res: Response) => {
     const { id } = req.params;
     try {
          const tenantId: number = parseInt(req.query.tenantId as string, 10);
          const taskService = new PrimeLimsTabletasksService('tasks');
          const deletedRows = await taskService.delete(tenantId, Number(id));
          if (deletedRows) {
               res.status(204).end();
          } else {
               res.status(404).json({ error: 'Task not found' });
          }
     } catch (error) {
          res.status(500).json({ error: 'Failed to delete task' });
     }
};

export const listTasks = async (req: Request<{}, {}, {}, { count: number; page: number; tenantId: string ,sortby: 'DESC' | 'ASC'}>, res: Response) => {
     try {
          const { page = 1, count = 10, tenantId, sortby = 'DESC' } = req.query;
          const tenantIdNum = parseInt(tenantId, 10);
          const taskService = new PrimeLimsTabletasksService('tasks');
          const tasks = await taskService.list(tenantIdNum, page, count, sortby);
          res.status(200).json(tasks);
     } catch (error) {
          res.status(500).json({ error: 'Failed to fetch tasks' });
     }
};
