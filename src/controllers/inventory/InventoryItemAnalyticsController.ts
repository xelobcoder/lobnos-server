import { Request, Response } from 'express';
import { InventoryItemAnalyticsModel } from '../../models/inventory/InventoryItemAnalytics';

export interface ApiResponse<T> {
     success: boolean;
     message: string;
     data?: T;
     error?: {
          code: string;
          message: string;
     };
}

export class InventoryItemAnalyticsController {
     private getTenantId(req: Request): number {
          const tenantId = parseInt(req.query.tenantId as string);
          if (!tenantId || isNaN(tenantId)) {
               throw new Error('Tenant ID is required');
          }
          return tenantId;
     }

     private validateDate(dateString: string | undefined): string | undefined {
          if (!dateString) return undefined;
          const date = new Date(dateString);
          if (isNaN(date.getTime())) {
               throw new Error(`Invalid date format: ${dateString}`);
          }
          return dateString;
     }

     async getItemAnalyticsSummary(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const  itemId  = req.params.itemId as string;
               const { startDate, endDate } = req.query;

               if (!itemId) {
                    const response: ApiResponse<null> = {
                         success: false,
                         message: 'Item ID is required',
                         error: {
                              code: 'MISSING_ITEM_ID',
                              message: 'Item ID is required'
                         }
                    };
                    res.status(400).json(response);
                    return;
               }

               // Validate dates
               const validatedStartDate = this.validateDate(startDate as string);
               const validatedEndDate = this.validateDate(endDate as string);

               const analyticsModel = new InventoryItemAnalyticsModel(tenantId);
               const analytics = await analyticsModel.getItemAnalyticsSummary(
                    itemId,
                    validatedStartDate,
                    validatedEndDate
               );

               const response: ApiResponse<any> = {
                    success: true,
                    message: 'Item analytics summary retrieved successfully',
                    data: analytics
               };

               res.status(200).json(response);
          } catch (error) {
               console.error('Error getting item analytics summary:', error);
               const response: ApiResponse<null> = {
                    success: false,
                    message: error instanceof Error ? error.message : 'Internal server error',
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error instanceof Error ? error.message : 'Internal server error'
                    }
               };
               res.status(500).json(response);
          }
     }

     async getItemOrderAnalytics(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const  itemId  = req.params.itemId as string;
               const { startDate, endDate } = req.query;

               if (!itemId) {
                    const response: ApiResponse<null> = {
                         success: false,
                         message: 'Item ID is required',
                         error: {
                              code: 'MISSING_ITEM_ID',
                              message: 'Item ID is required'
                         }
                    };
                    res.status(400).json(response);
                    return;
               }

               // Validate dates
               const validatedStartDate = this.validateDate(startDate as string);
               const validatedEndDate = this.validateDate(endDate as string);

               const analyticsModel = new InventoryItemAnalyticsModel(tenantId);
               const analytics = await analyticsModel.getItemOrderAnalytics(
                    itemId,
                    validatedStartDate,
                    validatedEndDate
               );

               const response: ApiResponse<any> = {
                    success: true,
                    message: 'Item order analytics retrieved successfully',
                    data: analytics
               };

               res.status(200).json(response);
          } catch (error) {
               console.error('Error getting item order analytics:', error);
               const response: ApiResponse<null> = {
                    success: false,
                    message: error instanceof Error ? error.message : 'Internal server error',
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error instanceof Error ? error.message : 'Internal server error'
                    }
               };
               res.status(500).json(response);
          }
     }

     async getItemUsageAnalytics(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const  itemId  = req.params.itemId as string;
               const { startDate, endDate } = req.query;

               if (!itemId) {
                    const response: ApiResponse<null> = {
                         success: false,
                         message: 'Item ID is required',
                         error: {
                              code: 'MISSING_ITEM_ID',
                              message: 'Item ID is required'
                         }
                    };
                    res.status(400).json(response);
                    return;
               }

               // Validate dates
               const validatedStartDate = this.validateDate(startDate as string);
               const validatedEndDate = this.validateDate(endDate as string);

               const analyticsModel = new InventoryItemAnalyticsModel(tenantId);
               const analytics = await analyticsModel.getItemUsageAnalytics(
                    itemId,
                    validatedStartDate,
                    validatedEndDate
               );

               const response: ApiResponse<any> = {
                    success: true,
                    message: 'Item usage analytics retrieved successfully',
                    data: analytics
               };

               res.status(200).json(response);
          } catch (error) {
               console.error('Error getting item usage analytics:', error);
               const response: ApiResponse<null> = {
                    success: false,
                    message: error instanceof Error ? error.message : 'Internal server error',
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error instanceof Error ? error.message : 'Internal server error'
                    }
               };
               res.status(500).json(response);
          }
     }

     async getDailyConsumptionAnalytics(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const  itemId  = req.params.itemId as string;
               const { startDate, endDate } = req.query;

               if (!itemId) {
                    const response: ApiResponse<null> = {
                         success: false,
                         message: 'Item ID is required',
                         error: {
                              code: 'MISSING_ITEM_ID',
                              message: 'Item ID is required'
                         }
                    };
                    res.status(400).json(response);
                    return;
               }

               // Validate dates
               const validatedStartDate = this.validateDate(startDate as string);
               const validatedEndDate = this.validateDate(endDate as string);

               const analyticsModel = new InventoryItemAnalyticsModel(tenantId);
               const analytics = await analyticsModel.getDailyConsumptionAnalytics(
                    itemId,
                    validatedStartDate,
                    validatedEndDate
               );

               const response: ApiResponse<any> = {
                    success: true,
                    message: 'Daily consumption analytics retrieved successfully',
                    data: analytics
               };

               res.status(200).json(response);
          } catch (error) {
               console.error('Error getting daily consumption analytics:', error);
               const response: ApiResponse<null> = {
                    success: false,
                    message: error instanceof Error ? error.message : 'Internal server error',
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error instanceof Error ? error.message : 'Internal server error'
                    }
               };
               res.status(500).json(response);
          }
     }

     async getMonthlyConsumptionAnalytics(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const  itemId  = req.params.itemId as string;

               if (!itemId) {
                    const response: ApiResponse<null> = {
                         success: false,
                         message: 'Item ID is required',
                         error: {
                              code: 'MISSING_ITEM_ID',
                              message: 'Item ID is required'
                         }
                    };
                    res.status(400).json(response);
                    return;
               }

               const analyticsModel = new InventoryItemAnalyticsModel(tenantId);
               const analytics = await analyticsModel.getMonthlyConsumptionAnalytics(itemId);

               const response: ApiResponse<any> = {
                    success: true,
                    message: 'Monthly consumption analytics retrieved successfully',
                    data: analytics
               };

               res.status(200).json(response);
          } catch (error) {
               console.error('Error getting monthly consumption analytics:', error);
               const response: ApiResponse<null> = {
                    success: false,
                    message: error instanceof Error ? error.message : 'Internal server error',
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error instanceof Error ? error.message : 'Internal server error'
                    }
               };
               res.status(500).json(response);
          }
     }

     async getYearlyConsumptionAnalytics(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const  itemId  = req.params.itemId as string;

               if (!itemId) {
                    const response: ApiResponse<null> = {
                         success: false,
                         message: 'Item ID is required',
                         error: {
                              code: 'MISSING_ITEM_ID',
                              message: 'Item ID is required'
                         }
                    };
                    res.status(400).json(response);
                    return;
               }

               const analyticsModel = new InventoryItemAnalyticsModel(tenantId);
               const analytics = await analyticsModel.getYearlyConsumptionAnalytics(itemId);

               const response: ApiResponse<any> = {
                    success: true,
                    message: 'Yearly consumption analytics retrieved successfully',
                    data: analytics
               };

               res.status(200).json(response);
          } catch (error) {
               console.error('Error getting yearly consumption analytics:', error);
               const response: ApiResponse<null> = {
                    success: false,
                    message: error instanceof Error ? error.message : 'Internal server error',
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error instanceof Error ? error.message : 'Internal server error'
                    }
               };
               res.status(500).json(response);
          }
     }

     async getDailyWastageAnalytics(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const  itemId  = req.params.itemId as string;
               const { startDate, endDate } = req.query;

               if (!itemId) {
                    const response: ApiResponse<null> = {
                         success: false,
                         message: 'Item ID is required',
                         error: {
                              code: 'MISSING_ITEM_ID',
                              message: 'Item ID is required'
                         }
                    };
                    res.status(400).json(response);
                    return;
               }

               // Validate dates
               const validatedStartDate = this.validateDate(startDate as string);
               const validatedEndDate = this.validateDate(endDate as string);

               const analyticsModel = new InventoryItemAnalyticsModel(tenantId);
               const analytics = await analyticsModel.getDailyWastageAnalytics(
                    itemId,
                    validatedStartDate,
                    validatedEndDate
               );

               const response: ApiResponse<any> = {
                    success: true,
                    message: 'Daily wastage analytics retrieved successfully',
                    data: analytics
               };

               res.status(200).json(response);
          } catch (error) {
               console.error('Error getting daily wastage analytics:', error);
               const response: ApiResponse<null> = {
                    success: false,
                    message: error instanceof Error ? error.message : 'Internal server error',
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error instanceof Error ? error.message : 'Internal server error'
                    }
               };
               res.status(500).json(response);
          }
     }

     async getMonthlyWastageAnalytics(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const  itemId  = req.params.itemId as string;

               if (!itemId) {
                    const response: ApiResponse<null> = {
                         success: false,
                         message: 'Item ID is required',
                         error: {
                              code: 'MISSING_ITEM_ID',
                              message: 'Item ID is required'
                         }
                    };
                    res.status(400).json(response);
                    return;
               }

               const analyticsModel = new InventoryItemAnalyticsModel(tenantId);
               const analytics = await analyticsModel.getMonthlyWastageAnalytics(itemId);

               const response: ApiResponse<any> = {
                    success: true,
                    message: 'Monthly wastage analytics retrieved successfully',
                    data: analytics
               };

               res.status(200).json(response);
          } catch (error) {
               console.error('Error getting monthly wastage analytics:', error);
               const response: ApiResponse<null> = {
                    success: false,
                    message: error instanceof Error ? error.message : 'Internal server error',
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error instanceof Error ? error.message : 'Internal server error'
                    }
               };
               res.status(500).json(response);
          }
     }

     async getYearlyWastageAnalytics(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const  itemId  = req.params.itemId as string;

               if (!itemId) {
                    const response: ApiResponse<null> = {
                         success: false,
                         message: 'Item ID is required',
                         error: {
                              code: 'MISSING_ITEM_ID',
                              message: 'Item ID is required'
                         }
                    };
                    res.status(400).json(response);
                    return;
               }

               const analyticsModel = new InventoryItemAnalyticsModel(tenantId);
               const analytics = await analyticsModel.getYearlyWastageAnalytics(itemId);

               const response: ApiResponse<any> = {
                    success: true,
                    message: 'Yearly wastage analytics retrieved successfully',
                    data: analytics
               };

               res.status(200).json(response);
          } catch (error) {
               console.error('Error getting yearly wastage analytics:', error);
               const response: ApiResponse<null> = {
                    success: false,
                    message: error instanceof Error ? error.message : 'Internal server error',
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error instanceof Error ? error.message : 'Internal server error'
                    }
               };
               res.status(500).json(response);
          }
     }

     async getDailyOrderAnalytics(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const  itemId  = req.params.itemId as string;
               const { startDate, endDate } = req.query;

               if (!itemId) {
                    const response: ApiResponse<null> = {
                         success: false,
                         message: 'Item ID is required',
                         error: {
                              code: 'MISSING_ITEM_ID',
                              message: 'Item ID is required'
                         }
                    };
                    res.status(400).json(response);
                    return;
               }

               // Validate dates
               const validatedStartDate = this.validateDate(startDate as string);
               const validatedEndDate = this.validateDate(endDate as string);

               const analyticsModel = new InventoryItemAnalyticsModel(tenantId);
               const analytics = await analyticsModel.getDailyOrderAnalytics(
                    itemId,
                    validatedStartDate,
                    validatedEndDate
               );

               const response: ApiResponse<any> = {
                    success: true,
                    message: 'Daily order analytics retrieved successfully',
                    data: analytics
               };

               res.status(200).json(response);
          } catch (error) {
               console.error('Error getting daily order analytics:', error);
               const response: ApiResponse<null> = {
                    success: false,
                    message: error instanceof Error ? error.message : 'Internal server error',
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error instanceof Error ? error.message : 'Internal server error'
                    }
               };
               res.status(500).json(response);
          }
     }

     async getMonthlyOrderAnalytics(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const  itemId  = req.params.itemId as string;

               if (!itemId) {
                    const response: ApiResponse<null> = {
                         success: false,
                         message: 'Item ID is required',
                         error: {
                              code: 'MISSING_ITEM_ID',
                              message: 'Item ID is required'
                         }
                    };
                    res.status(400).json(response);
                    return;
               }

               const analyticsModel = new InventoryItemAnalyticsModel(tenantId);
               const analytics = await analyticsModel.getMonthlyOrderAnalytics(itemId);

               const response: ApiResponse<any> = {
                    success: true,
                    message: 'Monthly order analytics retrieved successfully',
                    data: analytics
               };

               res.status(200).json(response);
          } catch (error) {
               console.error('Error getting monthly order analytics:', error);
               const response: ApiResponse<null> = {
                    success: false,
                    message: error instanceof Error ? error.message : 'Internal server error',
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error instanceof Error ? error.message : 'Internal server error'
                    }
               };
               res.status(500).json(response);
          }
     }

     async getYearlyOrderAnalytics(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const  itemId  = req.params.itemId as string;

               if (!itemId) {
                    const response: ApiResponse<null> = {
                         success: false,
                         message: 'Item ID is required',
                         error: {
                              code: 'MISSING_ITEM_ID',
                              message: 'Item ID is required'
                         }
                    };
                    res.status(400).json(response);
                    return;
               }

               const analyticsModel = new InventoryItemAnalyticsModel(tenantId);
               const analytics = await analyticsModel.getYearlyOrderAnalytics(itemId);

               const response: ApiResponse<any> = {
                    success: true,
                    message: 'Yearly order analytics retrieved successfully',
                    data: analytics
               };

               res.status(200).json(response);
          } catch (error) {
               console.error('Error getting yearly order analytics:', error);
               const response: ApiResponse<null> = {
                    success: false,
                    message: error instanceof Error ? error.message : 'Internal server error',
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error instanceof Error ? error.message : 'Internal server error'
                    }
               };
               res.status(500).json(response);
          }
     }

     async getItemWastageAnalytics(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const  itemId  = req.params.itemId as string;
               const { startDate, endDate } = req.query;

               if (!itemId) {
                    const response: ApiResponse<null> = {
                         success: false,
                         message: 'Item ID is required',
                         error: {
                              code: 'MISSING_ITEM_ID',
                              message: 'Item ID is required'
                         }
                    };
                    res.status(400).json(response);
                    return;
               }

               // Validate dates
               const validatedStartDate = this.validateDate(startDate as string);
               const validatedEndDate = this.validateDate(endDate as string);

               const analyticsModel = new InventoryItemAnalyticsModel(tenantId);
               const analytics = await analyticsModel.getItemWastageAnalytics(
                    itemId,
                    validatedStartDate,
                    validatedEndDate
               );

               const response: ApiResponse<any> = {
                    success: true,
                    message: 'Item wastage analytics retrieved successfully',
                    data: analytics
               };

               res.status(200).json(response);
          } catch (error) {
               console.error('Error getting item wastage analytics:', error);
               const response: ApiResponse<null> = {
                    success: false,
                    message: error instanceof Error ? error.message : 'Internal server error',
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error instanceof Error ? error.message : 'Internal server error'
                    }
               };
               res.status(500).json(response);
          }
     }

     async getSupplierSpecificAnalytics(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const  itemId  = req.params.itemId as string;
               const { supplierId, startDate, endDate } = req.query;

               if (!itemId) {
                    const response: ApiResponse<null> = {
                         success: false,
                         message: 'Item ID is required',
                         error: {
                              code: 'MISSING_ITEM_ID',
                              message: 'Item ID is required'
                         }
                    };
                    res.status(400).json(response);
                    return;
               }

               // Validate dates
               const validatedStartDate = this.validateDate(startDate as string);
               const validatedEndDate = this.validateDate(endDate as string);

               const analyticsModel = new InventoryItemAnalyticsModel(tenantId);
               const analytics = await analyticsModel.getSupplierSpecificAnalytics(
                    itemId,
                    supplierId as string,
                    validatedStartDate,
                    validatedEndDate
               );

               const response: ApiResponse<any> = {
                    success: true,
                    message: 'Supplier-specific analytics retrieved successfully',
                    data: analytics
               };

               res.status(200).json(response);
          } catch (error) {
               console.error('Error getting supplier-specific analytics:', error);
               const response: ApiResponse<null> = {
                    success: false,
                    message: error instanceof Error ? error.message : 'Internal server error',
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error instanceof Error ? error.message : 'Internal server error'
                    }
               };
               res.status(500).json(response);
          }
     }

     async getSupplierPerformanceMetrics(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const  itemId  = req.params.itemId as string;
               const { startDate, endDate } = req.query;

               if (!itemId) {
                    const response: ApiResponse<null> = {
                         success: false,
                         message: 'Item ID is required',
                         error: {
                              code: 'MISSING_ITEM_ID',
                              message: 'Item ID is required'
                         }
                    };
                    res.status(400).json(response);
                    return;
               }

               // Validate dates
               const validatedStartDate = this.validateDate(startDate as string);
               const validatedEndDate = this.validateDate(endDate as string);

               const analyticsModel = new InventoryItemAnalyticsModel(tenantId);
               const analytics = await analyticsModel.getSupplierPerformanceMetrics(
                    itemId,
                    validatedStartDate,
                    validatedEndDate
               );

               const response: ApiResponse<any> = {
                    success: true,
                    message: 'Supplier performance metrics retrieved successfully',
                    data: analytics
               };

               res.status(200).json(response);
          } catch (error) {
               console.error('Error getting supplier performance metrics:', error);
               const response: ApiResponse<null> = {
                    success: false,
                    message: error instanceof Error ? error.message : 'Internal server error',
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error instanceof Error ? error.message : 'Internal server error'
                    }
               };
               res.status(500).json(response);
          }
     }

     async getTestConsumptionAnalytics(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const  itemId  = req.params.itemId as string;
               const { startDate, endDate } = req.query;

               if (!itemId) {
                    const response: ApiResponse<null> = {
                         success: false,
                         message: 'Item ID is required',
                         error: {
                              code: 'MISSING_ITEM_ID',
                              message: 'Item ID is required'
                         }
                    };
                    res.status(400).json(response);
                    return;
               }

               // Validate dates
               const validatedStartDate = this.validateDate(startDate as string);
               const validatedEndDate = this.validateDate(endDate as string);

               const analyticsModel = new InventoryItemAnalyticsModel(tenantId);
               const analytics = await analyticsModel.getTestConsumptionAnalytics(
                    itemId,
                    validatedStartDate,
                    validatedEndDate
               );

               const response: ApiResponse<any> = {
                    success: true,
                    message: 'Test consumption analytics retrieved successfully',
                    data: analytics
               };

               res.status(200).json(response);
          } catch (error) {
               console.error('Error getting test consumption analytics:', error);
               const response: ApiResponse<null> = {
                    success: false,
                    message: error instanceof Error ? error.message : 'Internal server error',
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error instanceof Error ? error.message : 'Internal server error'
                    }
               };
               res.status(500).json(response);
          }
     }

     async getAverageConsumption(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const  itemId  = req.params.itemId as string;
               const { startDate, endDate } = req.query;

               if (!itemId) {
                    const response: ApiResponse<null> = {
                         success: false,
                         message: 'Item ID is required',
                         error: {
                              code: 'MISSING_ITEM_ID',
                              message: 'Item ID is required'
                         }
                    };
                    res.status(400).json(response);
                    return;
               }

               // Validate dates
               const validatedStartDate = this.validateDate(startDate as string);
               const validatedEndDate = this.validateDate(endDate as string);

               const analyticsModel = new InventoryItemAnalyticsModel(tenantId);
               const analytics = await analyticsModel.getAverageConsumption(
                    itemId,
                    validatedStartDate,
                    validatedEndDate
               );

               const response: ApiResponse<any> = {
                    success: true,
                    message: 'Average consumption analytics retrieved successfully',
                    data: analytics
               };

               res.status(200).json(response);
          } catch (error) {
               console.error('Error getting average consumption analytics:', error);
               const response: ApiResponse<null> = {
                    success: false,
                    message: error instanceof Error ? error.message : 'Internal server error',
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error instanceof Error ? error.message : 'Internal server error'
                    }
               };
               res.status(500).json(response);
          }
     }
}