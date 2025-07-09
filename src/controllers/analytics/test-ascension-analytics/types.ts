interface TatDataQuery {
     page?: string;
     count?: string;
     sorting?: 'ASC' | 'DESC';
     tenantId:string
}

interface TatDataResponse {
     success: boolean;
     data?: any[];
     message?: string;
}