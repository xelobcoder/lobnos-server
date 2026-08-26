export interface BrowserInformation {
     userAgent?: string;
     browser?: string;
     browserVersion?: string;
     operatingSystem?: string;
     device?: string;
     ipAddress?: string;
}




export interface ILoginLog {
     keyid: number;
     loginTime?: Date;
     employeeid: number;
     loginSessionId: string;
     logoutTime?: Date;
     actualLogout?: Date;
     browserInformation: BrowserInformation;
     loggedout?: boolean;
}