interface TenantDBConfig {
     host: string;
     user: string;
     password: string;
     database: string;
     port?: number;
     connectionLimit: number;
}


interface PrimeLimsTenant {
     tenantid: number;
     name: string;
     createdon: Date;
     isActive: number;
     updatedOn: Date;
     referedid: string;
     expirydate: Date;
}