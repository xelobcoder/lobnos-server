export interface IHomeCollectionArea {
     id: number;
     area_name: string;
     collection_fee: number;
     is_active: boolean;
}

export interface IHomeCollectionStaff {
     id: number;
     employeeid: number;
     vehicle_number: string;
     is_available: boolean;
     staff_name?: string;
     staff_mobile?: string;
}

export type HomeCollectionOrderStatus =
     | 'Pending'
     | 'Confirmed'
     | 'Assigned'
     | 'EnRoute'
     | 'Collected'
     | 'Received'
     | 'Completed'
     | 'Cancelled';

export interface IHomeCollectionOrder {
     id: number;
     patientid: number;
     billingid: number | null;
     appointment_date: string;
     appointment_time: string;
     address: string;
     latitude: number;
     longitude: number;
     collection_fee: number;
     assigned_to: number | null;
     status: HomeCollectionOrderStatus;
     created_at: string;
     patient_name?: string;
     patient_mobile?: string;
     staff_name?: string;
     tests?: IHomeCollectionOrderTest[];
}

export interface IOrderListFilters {
     page: number;
     count: number;
     status?: HomeCollectionOrderStatus;
     assignedTo?: number;
     fromDate?: string;
     toDate?: string;
     /** Matches against patient name or patient id. */
     search?: string;
}

export interface IHomeCollectionChecklistItem {
     id: number;
     home_collection_id: number;
     checklist_stage: 'BEFORE_COLLECTION' | 'DURING_COLLECTION' | 'AFTER_COLLECTION';
     checklist_item: string;
     is_completed: boolean;
     completed_at: string | null;
     completed_by: number | null;
     remarks: string | null;
}

export interface IHomeCollectionOrderTest {
     id: number;
     home_collection_id: number;
     testid: number;
     test_name_snapshot: string;
     price: number;
}

/**
 * Data access for the home collection module (pickup areas, roving staff, patient
 * pickup orders with GPS coordinates, and the pre/during/after collection checklist).
 */
export interface IHomeCollectionRepository {
     createArea(area: Partial<IHomeCollectionArea>): Promise<number>;
     listAreas(activeOnly?: boolean): Promise<IHomeCollectionArea[]>;
     updateArea(id: number, area: Partial<IHomeCollectionArea>): Promise<number>;

     createStaff(staff: Partial<IHomeCollectionStaff>): Promise<number>;
     /** Joins `roles` to surface the staff member's name/mobile alongside their vehicle/availability. */
     listStaff(availableOnly?: boolean): Promise<IHomeCollectionStaff[]>;
     updateStaff(id: number, staff: Partial<IHomeCollectionStaff>): Promise<number>;

     /** Creates the order and its linked test panels (home_collection_order_tests) in one transaction. */
     createOrderWithTests(order: Partial<IHomeCollectionOrder>, tests: Array<{ testid: number; test_name_snapshot: string; price: number }>): Promise<number>;
     /**
      * Creates a home collection order for an already-billed patient, pulling the tests
      * straight from `dboservices` for that billingid instead of requiring re-selection.
      */
     createOrderFromBilling(
          billingid: number,
          order: Omit<Partial<IHomeCollectionOrder>, 'billingid'>
     ): Promise<number>;
     findOrderById(id: number): Promise<IHomeCollectionOrder | undefined>;
     listOrders(filters: IOrderListFilters): Promise<{ orders: IHomeCollectionOrder[]; total: number }>;
     updateOrderStatus(id: number, status: HomeCollectionOrderStatus): Promise<number>;
     /** Assigning staff also flips the order status to 'Assigned'. */
     assignOrder(id: number, assignedTo: number): Promise<number>;
     getOrderTests(homeCollectionId: number): Promise<IHomeCollectionOrderTest[]>;

     getChecklistForOrder(homeCollectionId: number): Promise<IHomeCollectionChecklistItem[]>;
     updateChecklistItem(id: number, data: Partial<IHomeCollectionChecklistItem>): Promise<number>;
}
