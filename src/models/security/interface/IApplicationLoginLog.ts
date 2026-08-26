import { ILoginLog } from "../entities/loginlogs.entities";

export interface IApplicationLoginLog {
     /**
     * @description: This method is used to create a new login history log for a user.
     * @param {number} employeeid - The ID of the employee.
     * @param {string} browserInformation - The browser information of the user.
     * @return {Promise<number>} - A promise that resolves to the ID of the created log.
     */
     createHistoryLog(employeeid: number, browserInformation: string, trx?: any): Promise<number>;

     /**
     * @description: This method is used to update the logout time and other details of a user's login history log.
     * @param {number} employeeid - The ID of the employee.
     * @param {number} tenantId - The ID of the tenant.
     * @param {string} loginSessionId - The session ID of the login.
     * @param {Date} logoutTime - The time when the user logged out.
     * @param {Date} actualLogout - The actual time when the user logged out.
     * @param {boolean} loggedout - A boolean indicating whether the user has logged out.
     * @return {Promise<void>} - A promise that resolves when the log is updated.
     */
     updateHistoryLog(employeeid: number, tenantId: number, loginSessionId: string, logoutTime: Date, actualLogout: Date, loggedout: boolean, trx?: any): Promise<void>;

     /**
     * @description: This method is used to check if a user can initiate a new login session.
     * @param {number} employeeid - The ID of the employee.
     * @return {Promise<boolean>} - A promise that resolves to true if the user can initiate a new login session, false otherwise.
     */
     getCanInitiateLogin(employeeid: number): Promise<boolean>;
     /**
     * @description: This method is used to get the current active login sessions of a user.
     * @param {number} employeeid - The ID of the employee.
     * @return {Promise<ILoginLog[]>} - A promise that resolves to an array of active login sessions.
     */
     getCurrentUserLoginActiveSessions(employeeid: number): Promise<ILoginLog[]>;
     getCurrentLoginCounts(employeeid: number): Promise<number>;

     /**
     * @description: This method is used to get the current login sessions of a user.
     * @param {number} employeeid - The ID of the employee.
     * @return {Promise<any[]>} - A promise that resolves to an array of current login sessions.
     */
     getCurrentUserLoginSessions(employeeid: number): Promise<any[]>;
     /**
     * @description: This method is used to get the current login sessions of a user with additional details.
     * @param {number} employeeid - The ID of the employee.
     * @return {Promise<any[]>} - A promise that resolves to an array of current login sessions with details.
     */
     getCurrentUserLoginSessionsWithDetails(employeeid: number): Promise<any[]>;
     /**
     * @description: This method is used to destroy all login sessions of a user.
     * @param {number} employeeid - The ID of the employee.
     * @return {Promise<boolean | undefined>} - A promise that resolves to true if the sessions were destroyed, false otherwise.
     */
     destroyUserSessions(employeeid: number, trx?: any): Promise<boolean | undefined>;
     /**
      * @description: This method is used to create a unique session ID for a user's login session.
      * @return {string} - A unique session ID.
      */
     createLogOutTime(): string;

     getCurrentUserLoginActiveSessions(employeeid: number): Promise<ILoginLog[]>;
     getCurrentUserLoginSessionsWithDetails(employeeid: number): Promise<any[]>;
     getCanInitiateLogin(employeeid: number): Promise<boolean>;
     destroyUserSessions(employeeid: number, trx?: any): Promise<boolean | undefined>;
}