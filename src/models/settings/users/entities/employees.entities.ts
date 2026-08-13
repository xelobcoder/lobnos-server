export type EmployeeDocumentType =
     | 'cv'
     | 'certificate'
     | 'license'
     | 'passport'
     | 'national_id'
     | 'appointment_letter'
     | 'other';

export type EmployeeAccountState = boolean | number | null;
export type DateLike = Date | string | null;

export interface EmployeesDesignationEntity {
     designationId?: number;
     departmentId?: number | null;
     designationName: string;
     description?: string | null;
     createdAt?: DateLike;
}

export interface EmployeesCredentialEntity {
     credentialId?: number;
     employeeId: number;
     username: string;
     passwordHash: string;
     pin?: number | null;
     refreshToken?: string | null;
     emailVerified?: EmployeeAccountState;
     accountActivated?: EmployeeAccountState;
     lastLogin?: DateLike;
     createdAt?: DateLike;
}

export interface EmployeesContactEntity {
     contactId?: number;
     employeeId: number;
     email?: string | null;
     mobile?: string | null;
     alternativeMobile?: string | null;
     address?: string | null;
     city?: string | null;
     state?: string | null;
     country?: string | null;
     postalCode?: string | null;
     createdAt?: DateLike;
}

export interface EmployeesRoleAssignmentEntity {
     employeeId: number;
     roleId: number;
     assignedAt?: DateLike;
}

export interface EmployeesRolePermissionEntity {
     roleId: number;
     permissionId: number;
}

export interface EmployeesEducationEntity {
     educationId?: number;
     employeeId: number;
     institution: string;
     degree?: string | null;
     fieldOfStudy?: string | null;
     startDate?: string | Date | null;
     endDate?: string | Date | null;
     grade?: string | null;
     certificateNumber?: string | null;
}

export interface EmployeesLicenseEntity {
     licenseId?: number;
     employeeId: number;
     licenseName?: string | null;
     licenseNumber?: string | null;
     issuingAuthority?: string | null;
     issueDate?: string | Date | null;
     expiryDate?: string | Date | null;
}

export interface EmployeesCertificationEntity {
     certificationId?: number;
     employeeId: number;
     certificationName?: string | null;
     organization?: string | null;
     issueDate?: string | Date | null;
     expiryDate?: string | Date | null;
}

export interface EmployeesEmploymentHistoryEntity {
     historyId?: number;
     employeeId: number;
     organization?: string | null;
     position?: string | null;
     startDate?: string | Date | null;
     endDate?: string | Date | null;
     responsibilities?: string | null;
}

export interface EmployeesEmergencyContactEntity {
     emergencyContactId?: number;
     employeeId: number;
     fullName: string;
     relationship?: string | null;
     mobile?: string | null;
     address?: string | null;
}

export interface EmployeesDocumentEntity {
     documentId?: number;
     employeeId: number;
     documentType?: EmployeeDocumentType | null;
     fileName?: string | null;
     filePath?: string | null;
     uploadedAt?: DateLike;
}

export interface EmployeesBankAccountEntity {
     bankAccountId?: number;
     employeeId: number;
     bankName?: string | null;
     accountName?: string | null;
     accountNumber?: string | null;
     branchName?: string | null;
     mobileMoneyNumber?: string | null;
}

export interface EmployeesAttendanceEntity {
     attendanceId?: number;
     employeeId: number;
     attendanceDate: string | Date;
     checkIn?: DateLike;
     checkOut?: DateLike;
}

export interface EmployeesPerformanceReviewEntity {
     reviewId?: number;
     employeeId: number;
     reviewerId?: number | null;
     reviewPeriodStart?: string | Date | null;
     reviewPeriodEnd?: string | Date | null;
     punctualityScore?: number | string | null;
     teamworkScore?: number | string | null;
     productivityScore?: number | string | null;
     communicationScore?: number | string | null;
     professionalismScore?: number | string | null;
     overallScore?: number | string | null;
     strengths?: string | null;
     weaknesses?: string | null;
     recommendations?: string | null;
     reviewComments?: string | null;
     reviewDate?: string | Date | null;
     createdAt?: DateLike;
}
