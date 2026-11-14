import type { Knex } from 'knex';

export async function findPatientsByPhone(db: Knex, number: string) {
	const data = await db('new_patients')
		.where(query => query.where('mobile_number', number).orWhere('relativecontactnumber', number).orWhere(secondary => secondary.whereNull('backup_patient_id').where('backup_phone', number))
			.orWhereIn('backup_patient_id', db('new_patients').select('patientid').where({ mobile_number: number, contactpointer: 'self' })))
		.select('patientid', 'fullpatientid', 'firstname', 'middlename', 'lastname', 'age', 'agetype', 'gender', 'date',
			'mobile_number', 'contactpointer', 'contact_relationship', 'relativecontactname', 'relativecontactnumber',
			'backup_phone', 'backup_contact_name', 'backup_relationship', 'backup_patient_id')
		.select(db.raw("EXISTS (SELECT 1 FROM new_patients owner WHERE owner.patientid = new_patients.backup_patient_id AND owner.mobile_number = ? AND owner.contactpointer = 'self') AS linked_number_matches", [number]))
		.orderBy('patientid');
	return data.map(row => {
		const primary = String(row.contactpointer === 'relative' ? row.relativecontactnumber : row.mobile_number) === number;
		const backup = row.backup_patient_id ? Number(row.linked_number_matches) === 1 : String(row.backup_phone) === number;
		return {
			...row, matched_phone: number,
			matched_priority: primary ? 'Primary' : 'Backup',
			matched_relationship: primary ? row.contact_relationship || (row.contactpointer === 'relative' ? 'relative' : 'self')
				: backup ? row.backup_relationship || 'other' : 'relative',
			matched_contact_name: primary ? row.relativecontactname : backup ? row.backup_contact_name : row.relativecontactname,
		};
	});
}
