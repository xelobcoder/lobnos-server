import { Request, Response } from 'express';
import { HomeCollectionRepository } from '../../../models/operations/sample/HomeCollection/repositories/HomeCollectionRepository';
import { customError } from '../../../hooks/helper';
import { PrimeSqlErrorHandler } from '../../../hooks/utility';
import { HomeCollectionOrderStatus } from '../../../models/operations/sample/HomeCollection/interfaces/IHomeCollectionRepository';
import { NotificationDispatcher } from '../../../models/application/notifications/services/NotificationDispatcher';

const repo = (request: Request) => new HomeCollectionRepository(parseInt(String(request.query.tenantId), 10));
const tenantIdOf = (request: Request) => parseInt(String(request.query.tenantId), 10);
const actorOf = (request: Request) => Number(request.query.employeeid) || undefined;

export class HomeCollectionController {
     static async createArea(request: Request, response: Response) {
          try {
               const id = await repo(request).createArea(request.body);
               response.status(201).json({ status: 'success', statusCode: 201, result: { id } });
          } catch (error: any) {
               PrimeSqlErrorHandler.handleError(error, response);
          }
     }

     static async listAreas(request: Request, response: Response) {
          try {
               const areas = await repo(request).listAreas(request.query.activeOnly === 'true');
               response.json({ status: 'success', statusCode: 200, result: areas });
          } catch (error: any) {
               PrimeSqlErrorHandler.handleError(error, response);
          }
     }

     static async updateArea(request: Request, response: Response) {
          try {
               const affected = await repo(request).updateArea(parseInt(String(request.params.id), 10), request.body);
               response.json({ status: 'success', statusCode: 200, result: { affected } });
          } catch (error: any) {
               PrimeSqlErrorHandler.handleError(error, response);
          }
     }

     static async createStaff(request: Request, response: Response) {
          try {
               const id = await repo(request).createStaff(request.body);
               response.status(201).json({ status: 'success', statusCode: 201, result: { id } });
          } catch (error: any) {
               PrimeSqlErrorHandler.handleError(error, response);
          }
     }

     static async listStaff(request: Request, response: Response) {
          try {
               const staff = await repo(request).listStaff(request.query.availableOnly === 'true');
               response.json({ status: 'success', statusCode: 200, result: staff });
          } catch (error: any) {
               PrimeSqlErrorHandler.handleError(error, response);
          }
     }

     static async updateStaff(request: Request, response: Response) {
          try {
               const affected = await repo(request).updateStaff(parseInt(String(request.params.id), 10), request.body);
               response.json({ status: 'success', statusCode: 200, result: { affected } });
          } catch (error: any) {
               PrimeSqlErrorHandler.handleError(error, response);
          }
     }

     static async createOrder(request: Request, response: Response) {
          try {
               const { latitude, longitude, tests } = request.body;
               if (latitude == null || longitude == null) {
                    return customError('latitude and longitude are required to schedule a home collection', 400, response);
               }
               const testRows = Array.isArray(tests)
                    ? tests.map((test: any) => ({ testid: Number(test.testid), test_name_snapshot: String(test.name || test.test_name_snapshot || ''), price: Number(test.price) || 0 }))
                    : [];
               const id = await repo(request).createOrderWithTests({ ...request.body, status: 'Pending' }, testRows);
               await NotificationDispatcher.dispatch(tenantIdOf(request), 'HOME_COLLECTION_SCHEDULED', {}, actorOf(request), {
                    context: { message: `A home collection was scheduled for patient #${request.body.patientid}.` }
               });
               response.status(201).json({ status: 'success', statusCode: 201, result: { id } });
          } catch (error: any) {
               PrimeSqlErrorHandler.handleError(error, response);
          }
     }

     static async getOrder(request: Request, response: Response) {
          try {
               const id = parseInt(String(request.params.id), 10);
               const order = await repo(request).findOrderById(id);
               if (!order) return customError('Home collection order not found', 404, response);
               const tests = await repo(request).getOrderTests(id);
               response.json({ status: 'success', statusCode: 200, result: { ...order, tests } });
          } catch (error: any) {
               PrimeSqlErrorHandler.handleError(error, response);
          }
     }

     /**
      * Called right after a billing is submitted with "Home collection" chosen as the
      * sample location. Pulls the tests already billed (dboservices) rather than
      * requiring them to be re-picked, so the order stays bound to that billing record.
      */
     static async createOrderFromBilling(request: Request, response: Response) {
          try {
               const { billingid, patientid, latitude, longitude } = request.body;
               if (!billingid || !patientid) return customError('billingid and patientid are required', 400, response);
               if (latitude == null || longitude == null) {
                    return customError('latitude and longitude are required to schedule a home collection', 400, response);
               }
               const id = await repo(request).createOrderFromBilling(Number(billingid), { ...request.body, status: 'Pending' });
               await NotificationDispatcher.dispatch(tenantIdOf(request), 'HOME_COLLECTION_SCHEDULED', {}, actorOf(request), {
                    context: { message: `A home collection was scheduled for patient #${patientid} (billing #${billingid}).` }
               });
               response.status(201).json({ status: 'success', statusCode: 201, result: { id } });
          } catch (error: any) {
               PrimeSqlErrorHandler.handleError(error, response);
          }
     }

     static async listOrders(request: Request, response: Response) {
          try {
               const { orders, total } = await repo(request).listOrders({
                    page: Number(request.query.page || 1),
                    count: Number(request.query.count || 20),
                    status: request.query.status as HomeCollectionOrderStatus | undefined,
                    assignedTo: request.query.assignedTo ? Number(request.query.assignedTo) : undefined,
                    fromDate: request.query.fromDate as string | undefined,
                    toDate: request.query.toDate as string | undefined,
                    search: request.query.search as string | undefined,
               });
               response.json({ status: 'success', statusCode: 200, result: { orders, total } });
          } catch (error: any) {
               PrimeSqlErrorHandler.handleError(error, response);
          }
     }

     static async updateOrderStatus(request: Request, response: Response) {
          try {
               const { status } = request.body;
               if (!status) return customError('status is required', 400, response);
               const affected = await repo(request).updateOrderStatus(parseInt(String(request.params.id), 10), status);
               await NotificationDispatcher.dispatch(tenantIdOf(request), 'HOME_COLLECTION_STATUS_UPDATED', {}, actorOf(request), {
                    context: { message: `Home collection order #${request.params.id} is now ${status}.` }
               });
               response.json({ status: 'success', statusCode: 200, result: { affected } });
          } catch (error: any) {
               PrimeSqlErrorHandler.handleError(error, response);
          }
     }

     static async assignOrder(request: Request, response: Response) {
          try {
               const { assigned_to } = request.body;
               if (!assigned_to) return customError('assigned_to is required', 400, response);
               const affected = await repo(request).assignOrder(parseInt(String(request.params.id), 10), Number(assigned_to));
               await NotificationDispatcher.dispatch(tenantIdOf(request), 'HOME_COLLECTION_ASSIGNED', {}, actorOf(request), {
                    context: { message: `Home collection order #${request.params.id} was assigned to staff #${assigned_to}.` }
               });
               response.json({ status: 'success', statusCode: 200, result: { affected } });
          } catch (error: any) {
               PrimeSqlErrorHandler.handleError(error, response);
          }
     }

     static async getChecklist(request: Request, response: Response) {
          try {
               const checklist = await repo(request).getChecklistForOrder(parseInt(String(request.params.id), 10));
               response.json({ status: 'success', statusCode: 200, result: checklist });
          } catch (error: any) {
               PrimeSqlErrorHandler.handleError(error, response);
          }
     }

     static async updateChecklistItem(request: Request, response: Response) {
          try {
               const data = { ...request.body };
               if (data.is_completed) {
                    data.completed_at = new Date();
               }
               const affected = await repo(request).updateChecklistItem(parseInt(String(request.params.id), 10), data);
               response.json({ status: 'success', statusCode: 200, result: { affected } });
          } catch (error: any) {
               PrimeSqlErrorHandler.handleError(error, response);
          }
     }
}
