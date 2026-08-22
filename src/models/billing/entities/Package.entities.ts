export type PackageAssignmentType = 'clinician' | 'organization';

export interface PackageAssignment {
     id?: number;
     assignment_type: PackageAssignmentType;
     clinician_id?: number | null;
     organization_id?: number | null;
     package_id: number;
     assigned_at?: Date | string;
}

export type ClinicianPackage = Omit<PackageAssignment, 'assignment_type' | 'organization_id'> & {
     clinician_id: number;
};

export type OrganizationPackage = Omit<PackageAssignment, 'assignment_type' | 'clinician_id'> & {
     organization_id: number;
};

export interface Package {
     id?: number;
     package_name: string;
     created_at?: Date | string;
     updated_at?: Date | string;
     created_by: number;
}

export interface PackageTest {
     id?: number;
     package_id: number;
     test_id: number;
     concession_mode: string;
     concession_value?: number;
}
