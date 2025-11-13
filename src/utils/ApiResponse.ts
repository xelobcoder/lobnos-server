// API Response Utilities
import { ApiResponse as IApiResponse } from "../models/inventory/types";

export class ApiResponse {
     static success<T = any>(data?: T, message?: string): IApiResponse<T> {
          return {
               success: true,
               data,
               ...(message && { message })
          };
     }

     static error(message: string, code: string = 'INTERNAL_ERROR', details?: any): IApiResponse {
          return {
               success: false,
               error: {
                    code,
                    message,
                    details
               }
          };
     }
}