			SELECT 
				np.PATIENTID AS patientid,
				CONCAT(np.FIRSTNAME,' ',np.MIDDLENAME,' ',np.LASTNAME) AS fullname,
				np.EMAIL AS email,
				CONCAT(0,np.MOBILE_NUMBER) AS mobileNumber,
				b.BILLINGID AS billingid,
				b.OUTSTANDING AS outstanding,
				b.DISCOUNT AS discount,
				b.PAID_AMOUNT AS paid_amount,
				b.PAYABLE AS payable,
				DATE(pt.DATE) as date
			FROM new_patients AS np
			INNER JOIN performing_test as pt ON pt.PATIENTID = np.PATIENTID
			INNER JOIN billing as b ON b.BILLINGID = pt.BILLINGID