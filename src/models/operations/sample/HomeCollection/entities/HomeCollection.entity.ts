export interface IHomeCollectionOrder {
     id: number;
     order_id: number;
     patientid: number;
     appointment_date: string;
     appointment_time: string;
     address: string;
     latitude: number;
     longitude: number;
     collection_fee: number;
     assigned_to: number;
     status: 'Pending' | 'Confirmed' | 'Assigned' | 'EnRoute' | 'Collected' | 'Received' | 'Completed' | 'Cancelled';
     created_at: string;
}


export interface IHomeCollectionChecklist {
     id: number;
     home_collection_id: number;
     checklist_stage: 'BEFORE_COLLECTION' | 'DURING_COLLECTION' | 'AFTER_COLLECTION';
     checklist_item: string;
     is_completed: boolean;
     completed_at: string | null;
     completed_by: number | null;
}



export interface IHomeCollectionStaff {
     id: number;
     employeeid: number;
     vehicle_number: string;
     is_available: boolean;
}



export interface IHomeCollectionAreas {
     id: number;
     area_name: string;
     collection_fee: number;
     is_active: boolean;
}