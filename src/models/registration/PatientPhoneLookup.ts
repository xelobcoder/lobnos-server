import type { Knex } from 'knex';

export async function findPatientsByPhone(db: Knex, number: string) {
	const data = await db('new_patients')
		.where(query => query.where('mobile_number', number).orWhere('relativecontactnumber', number).orWhere('backup_phone', number))
		.select('patientid', 'fullpatientid', 'firstname', 'middlename', 'lastname', 'age', 'agetype', 'gender', 'date',
			'mobile_number', 'contactpointer', 'contact_relationship', 'relativecontactname', 'relativecontactnumber',
			'backup_phone', 'backup_contact_name', 'backup_relationship')
		.orderBy('patientid');
	return data.map(row => {
		const primary = String(row.contactpointer === 'relative' ? row.relativecontactnumber : row.mobile_number) === number;
		const backup = String(row.backup_phone) === number;
		return {
			...row, matched_phone: number,
			matched_priority: primary ? 'Primary' : 'Backup',
			matched_relationship: primary ? row.contact_relationship || (row.contactpointer === 'relative' ? 'relative' : 'self')
				: backup ? row.backup_relationship || 'other' : 'relative',
			matched_contact_name: primary ? row.relativecontactname : backup ? row.backup_contact_name : row.relativecontactname,
		};
	});
}
