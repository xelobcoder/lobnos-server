/**
 * Interface representing a Manager with basic properties and methods.
 */
interface IManager {
  /**
   * Method to retrieve manager approvals for a specified duration.
   * @param tenantId The ID of the tenant.
   * @param duration The duration for which approvals are requested.
   */
  getManagerApprovals(tenantId: number, duration: string): void;

  /**
   * Method to verify if the current employee is a manager.
   * @param tenantId The ID of the tenant.
   * @returns Promise<boolean> indicating if the employee is a manager.
   */
  verificationManager(tenantId: number): Promise<boolean>;

  /**
   * Method to insert approval status into the database.
   * @param tenantId The ID of the tenant.
   * @param approvalStatus The approval status to be inserted.
   * @param message Optional message in case of decline.
   * @returns Promise<any> representing the result of the insertion.
   */
  insertApproval(tenantId: number, approvalStatus: boolean, message?: string | null): Promise<any>;

  /**
   * Method to retrieve tests ready for approvals.
   * @param tenantId The ID of the tenant.
   * @param request The HTTP request object.
   * @param response The HTTP response object.
   * @returns Promise<void> indicating completion of the operation.
   */
  getReadyForApprovals(tenantId: number, request: any, response: any): Promise<void>;
}
