export enum FreeServiceRequestStatus {
     PENDING = 'PENDING',
     APPROVED = 'APPROVED',
     REJECTED = 'REJECTED'
}

export interface FreeServiceRequest {
     id: number;
     requester_id: number;
     requester_name: string;
     reason: string;
     status: FreeServiceRequestStatus;
     reviewer_id?: number;
     reviewer_name?: string;
     reviewer_notes?: string;
     created_at: string;
     updated_at: string;
     approved_at?: string;
     rejected_at?: string;
}

export interface FreeServiceRequestItem {
     id: number;
     request_id: number;
     billing_id: number;
     service_id: number;
     service_name: string;
     original_price: number;
     created_at: string;
}

export interface CreateFreeServiceRequestDTO {
     requester_id: number;
     requester_name: string;
     reason: string;
     items: {
          billing_id: number;
          service_id: number;
          service_name: string;
          original_price: number;
     }[];
}

export interface ApproveFreeServiceRequestDTO {
     request_id: number;
     reviewer_id: number;
     reviewer_name: string;
     reviewer_notes?: string;
}

export interface RejectFreeServiceRequestDTO {
     request_id: number;
     reviewer_id: number;
     reviewer_name: string;
     reviewer_notes: string;
}

export interface FreeServiceRequestResponse {
     status: 'success' | 'error';
     statusCode: number;
     message: string;
     data?: any;
}


export interface IFreeServicesService {
     requestFreeService(request: CreateFreeServiceRequestDTO): Promise<number>;
     approveRequest(request: ApproveFreeServiceRequestDTO): Promise<void>;
     rejectRequest(request: RejectFreeServiceRequestDTO): Promise<void>;
     getRequestStatus(requestId: number): Promise<FreeServiceRequestStatus | null>;
     getRequest(requestId: number): Promise<any>;
     listRequests(page: number, limit: number, status?: FreeServiceRequestStatus): Promise<any>;
     getApprovalSummary(): Promise<any>;
     withdrawPendingRequest(requestId: number, requesterId: number): Promise<void>;
     getRequestsByBillingId(billingId: number): Promise<any[]>;
}