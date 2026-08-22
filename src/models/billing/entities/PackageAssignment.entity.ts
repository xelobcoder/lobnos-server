import { PackageAssignmentType } from './Package.entities';

export class PackageAssignmentEntity {
     id?: number;
     assignment_type: PackageAssignmentType;
     clinician_id: number | null;
     organization_id: number | null;
     package_id: number;
     assigned_at?: Date | string;

     constructor(data: {
          id?: number;
          assignment_type: PackageAssignmentType;
          clinician_id?: number | null;
          organization_id?: number | null;
          package_id: number;
          assigned_at?: Date | string;
     }) {
          this.id = data.id;
          this.assignment_type = data.assignment_type;
          this.clinician_id = data.clinician_id ?? null;
          this.organization_id = data.organization_id ?? null;
          this.package_id = data.package_id;
          this.assigned_at = data.assigned_at;
     }
}
