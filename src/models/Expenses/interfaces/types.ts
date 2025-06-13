export interface ExpenseData {
    employeeid: number;
    branchid: number;
    name: string;
    date: string;
    merchant?: string;
    amount: number;
    mode: string;
    description?: string;
    category: number;
}

export interface PaginationQuery {
    count: number;
    page: number;
}

export interface ExpenseCategory {
    id: number;
    name: string;
    created_by: number;
    created_at: string;
}

export interface ExpenseRecord {
    id: number;
    name: string;
    amount: number;
    mode: string;
    employeeId: number;
    branchId: number;
    description?: string;
    merchant?: string;
    category: number;
    date: string;
    approved: number;
    rejectionMessage?: string;
    images?: string[];
}