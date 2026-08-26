import KnexConnection from '../../database/KnexConnections';

const SYSTEM_EMPLOYEE_ID = 0;

export const STANDARD_EXPENSE_CATEGORIES = [
     'SALARY',
     'PAYROLL',
     'EMPLOYEE BENEFITS',
     'STAFF ALLOWANCES',
     'STAFF WELFARE',
     'OVERTIME',
     'BONUSES',
     'COMMISSIONS',
     'EMPLOYEE TRAINING',
     'RECRUITMENT',
     'SUPPLIER PAYMENTS',
     'SUPPLIER INVOICES',
     'INVENTORY PURCHASES',
     'RAW MATERIALS',
     'MEDICAL SUPPLIES',
     'OFFICE SUPPLIES',
     'EQUIPMENT SUPPLIES',
     'COMMISSION PAYMENTS',
     'SALES COMMISSIONS',
     'AGENT COMMISSIONS',
     'REFERRAL COMMISSIONS',
     'OUTSOURCING',
     'OUTSOURCING PAYMENT',
     'CONSULTING SERVICES',
     'PROFESSIONAL SERVICES',
     'LEGAL SERVICES',
     'ACCOUNTING SERVICES',
     'AUDIT SERVICES',
     'TECHNICAL SERVICES',
     'SOFTWARE SERVICES',
     'FREELANCE SERVICES',
     'RENT',
     'ELECTRICITY',
     'WATER',
     'INTERNET',
     'TELEPHONE',
     'WASTE MANAGEMENT',
     'SECURITY SERVICES',
     'CLEANING SERVICES',
     'MAINTENANCE AND REPAIRS',
     'TRANSPORTATION',
     'FUEL',
     'VEHICLE MAINTENANCE',
     'VEHICLE INSURANCE',
     'DELIVERY EXPENSES',
     'COURIER SERVICES',
     'TRAVEL EXPENSES',
     'ACCOMMODATION',
     'SOFTWARE SUBSCRIPTIONS',
     'CLOUD SERVICES',
     'HOSTING',
     'DOMAIN REGISTRATION',
     'SERVER MAINTENANCE',
     'IT SUPPORT',
     'HARDWARE',
     'SOFTWARE LICENSES',
     'ADVERTISING',
     'MARKETING',
     'SOCIAL MEDIA MARKETING',
     'PRINTING',
     'BRANDING',
     'PROMOTIONAL MATERIALS',
     'SALES EXPENSES',
     'BANK CHARGES',
     'TRANSACTION FEES',
     'PAYMENT PROCESSING FEES',
     'LOAN INTEREST',
     'FINANCE CHARGES',
     'FOREIGN EXCHANGE LOSS',
     'TAX EXPENSE',
     'BUSINESS REGISTRATION',
     'LICENSES AND PERMITS',
     'REGULATORY FEES',
     'GOVERNMENT FEES',
     'PENALTIES AND FINES',
     'INSURANCE',
     'PROPERTY INSURANCE',
     'BUSINESS INSURANCE',
     'PROFESSIONAL INDEMNITY',
     'ASSET PURCHASE',
     'EQUIPMENT PURCHASE',
     'FURNITURE PURCHASE',
     'VEHICLE PURCHASE',
     'DEPRECIATION',
     'AMORTIZATION',
     'BAD DEBT',
     'BAD DEBT EXPENSE',
     'INVENTORY LOSS',
     'INVENTORY ADJUSTMENT',
     'DAMAGED GOODS',
     'STOCK WRITE OFF',
     'CASH SHORTAGE',
     'OFFICE EXPENSES',
     'STATIONERY',
     'POSTAGE',
     'MEETING EXPENSES',
     'ENTERTAINMENT',
     'SUBSCRIPTIONS',
     'MEMBERSHIP FEES',
     'DONATIONS',
     'MISCELLANEOUS',
     'CUSTOMER REFUNDS',
     'SALES RETURNS',
     'DISCOUNTS GIVEN',
     'CREDIT NOTES',
     'OTHER EXPENSES',
];

function normalizeCategoryName(category: string): string {
     return category.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export async function bootstrapExpenseCategories(tenantId = 1): Promise<void> {
     const connection = await KnexConnection(tenantId);

     if (!(await connection.schema.hasTable('dboexpensecategory'))) return;

     const existingRows = await connection('dboexpensecategory').select('category');

     const existingCategories = new Set(existingRows.map((row: any) => normalizeCategoryName(String(row.category))));
     const rowsToInsert = STANDARD_EXPENSE_CATEGORIES
          .filter((category) => !existingCategories.has(normalizeCategoryName(category)))
          .map((category) => ({
               category,
               employeeid: SYSTEM_EMPLOYEE_ID,
               createdon: new Date(),
          }));

     if (rowsToInsert.length === 0) return;

     await connection('dboexpensecategory').insert(rowsToInsert);
}