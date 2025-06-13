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
     type: 'basic' | 'professional' | 'enterprise';
     createdon: Date;
     isActive: number;
     updatedOn: Date;
     referedid: string;
     expirydate: Date;
}