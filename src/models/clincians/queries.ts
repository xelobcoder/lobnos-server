const SQLQueries = {
	getAllClinicians: "SELECT * FROM clinicianbasicinfo",

	getAllCliniciansWithPaymentInfo: `
					SELECT 
			cbi.id            AS clinician_id,
			cbi.name,
			cbi.location,
			cbi.address,
			cbi.occupation,
			cbi.organization,
			cbi.updated_on    AS clinician_updated_on,
			cbi.created_on    AS clinician_created_on,
			cbi.phone,
			cbi.email,
			cbi.identifier,

			cpi.id            AS payment_id,
			cpi.clinicianid   AS payment_clinician_id,
			cpi.module,
			cpi.momo,
			cpi.bankname,
			cpi.bankbranch,
			cpi.accountnumber,
			cpi.accountname,
			cpi.updated_on    AS payment_updated_on,
			cpi.created_on    AS payment_created_on,
			cpi.commission,
			cpi.momoname

			FROM clinicianbasicinfo AS cbi
			LEFT JOIN clinicianpaymentinfo AS cpi 
			ON cbi.id = cpi.clinicianid
			ORDER BY cbi.name ASC;
  			`,

	getClinicianBasicInfo: `SELECT * FROM clinicianBasicInfo WHERE id = ?`,

	getCliniciansWithPagination: `SELECT * FROM clinicianbasicinfo
   LIMIT ? OFFSET ?`,

	getCliniciansWithExtendedPagination: `
		SELECT 
			cbi.id            AS clinician_id,
			cbi.name,
			cbi.location,
			cbi.address,
			cbi.occupation,
			cbi.organization,
			cbi.updated_on    AS clinician_updated_on,
			cbi.created_on    AS clinician_created_on,
			cbi.phone,
			cbi.email,
			cbi.identifier,

			cpi.id            AS payment_id,
			cpi.clinicianid   AS payment_clinician_id,
			cpi.module,
			cpi.momo,
			cpi.bankname,
			cpi.bankbranch,
			cpi.accountnumber,
			cpi.accountname,
			cpi.updated_on    AS payment_updated_on,
			cpi.created_on    AS payment_created_on,
			cpi.commission,
			cpi.momoname

			FROM clinicianbasicinfo AS cbi
			LEFT JOIN clinicianpaymentinfo AS cpi 
			ON cbi.id = cpi.clinicianid
			ORDER BY cbi.name ASC
			LIMIT ? OFFSET ?
   `,

	updateClinicianBasicInfo: `UPDATE clinicianbasicinfo SET NAME = ?, PHONE = ?, EMAIL = ?, LOCATION = ?,
     ADDRESS = ?,OCCUPATION = ? WHERE ID = ?`,

	deleteClinicianById: "DELETE FROM clinicianbasicinfo WHERE id = ?",

	insertClinicianBasicInfo: `INSERT INTO clinicianbasicinfo 
            (name,phone,email,location,address,
            occupation,organization) 
            VALUES (?,?,?,?,?,?,?)
		  `,

	getSingleClinicianById: "SELECT * FROM clinicianbasicinfo WHERE ID = ?",
	getTotalClinicians: `SELECT COUNT(*) AS total FROM clinicianbasicinfo`,


	getClinicianResult: `
			SELECT 
				b.billingid,
				np.patientid,
				tp.name,
				tt.testid,
				tt.approvalStatus AS approval,
				tt.collection,
				tt.ready,
				tt.processing,
				np.firstname,
				np.lastname,
				np.middlename,
				b.clinician,
				b.billedon
			FROM test_ascension AS tt 
			INNER JOIN billing AS b ON tt.billingid = b.billingid
			INNER JOIN new_patients AS np ON np.patientid = b.patientid 
			INNER JOIN test_panels AS tp ON tp.ID = tt.testid
			WHERE b.clinician = ?
			AND DATE(b.billedon) BETWEEN ? AND ?
    `,

	getBillingTestBasedByClinician: `
			SELECT 
				b.billingid,
				np.patientid,
				tp.name,
				tt.testid,
				tt.approvalStatus AS approval,
				tt.collection,
				tt.ready,
				tt.processing,
				np.firstname,
				np.lastname,
				np.middlename,
				b.clinician,
				b.billedon
			FROM test_ascension AS tt 
			INNER JOIN billing AS b ON tt.billingid = b.billingid
			INNER JOIN new_patients AS np ON np.patientid = b.patientid 
			INNER JOIN test_panels AS tp ON tp.ID = tt.testid
			WHERE b.clinician = ?
			AND b.billingid = ?
    `,


	getClinicianBatch: `SELECT * FROM clinicianbasicinfo LIMIT ? OFFSET ?`
};



export default SQLQueries;
