interface TatDataQuery {
     page?: string;
     count?: string;
     tenantId:string
}

interface TatDataResponse {
     success: boolean;
     data?: any[];
     message?: string;
}