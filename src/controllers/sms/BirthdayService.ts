import KnexConnection from "../../database/KnexConnections";
import { BirthdayQueries } from "../../models/application/sms/events/BirthdayQueries";

export interface PaginationParams {
     page?: number;
     limit?: number;
}

export interface PaginatedResponse<T> {
     data: T[];
     total: number;
     page: number;
     totalPages: number;
}

export class BirthdayService {
     async getTodaysBirthdays(tenantId: number, { page = 1, limit = 10 }: PaginationParams): Promise<PaginatedResponse<any>> {
          const connection = await KnexConnection(tenantId);
          const offset = (page - 1) * limit;

          const [data] = await connection.raw(BirthdayQueries.getTodaysBirthdays, [limit, offset]);
          const [countResult] = await connection.raw(BirthdayQueries.getTodaysBirthdaysCount);
          const total = countResult[0].total;

          return {
               data,
               total,
               page,
               totalPages: Math.ceil(total / limit)
          };
     }

     async getUpcomingBirthdays(tenantId: number, { page = 1, limit = 10 }: PaginationParams): Promise<PaginatedResponse<any>> {
          const connection = await KnexConnection(tenantId);
          const offset = (page - 1) * limit;

          const [data] = await connection.raw(BirthdayQueries.getUpcomingBirthdays, [limit, offset]);
          const [countResult] = await connection.raw(BirthdayQueries.getUpcomingBirthdaysCount);
          const total = countResult[0].total;

          return {
               data,
               total,
               page,
               totalPages: Math.ceil(total / limit)
          };
     }

     async getWeekBirthdays(tenantId: number, { page = 1, limit = 10 }: PaginationParams): Promise<PaginatedResponse<any>> {
          const connection = await KnexConnection(tenantId);
          const offset = (page - 1) * limit;

          const [data] = await connection.raw(BirthdayQueries.getWeekBirthdays, [limit, offset]);
          const [countResult] = await connection.raw(BirthdayQueries.getWeekBirthdaysCount);
          const total = countResult[0].total;

          return {
               data,
               total,
               page,
               totalPages: Math.ceil(total / limit)
          };
     }

     async getMonthBirthdays(tenantId: number, { page = 1, limit = 10 }: PaginationParams): Promise<PaginatedResponse<any>> {
          const connection = await KnexConnection(tenantId);
          const offset = (page - 1) * limit;

          const [data] = await connection.raw(BirthdayQueries.getMonthBirthdays, [limit, offset]);
          const [countResult] = await connection.raw(BirthdayQueries.getMonthBirthdaysCount);
          const total = countResult[0].total;

          return {
               data,
               total,
               page,
               totalPages: Math.ceil(total / limit)
          };
     }
}

