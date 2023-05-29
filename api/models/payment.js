const connection = require('../db')

class Payment {
	constructor(patientid) {
		this.patientid = patientid;
	}

	getClientTransactionInformation = (request, response) => {
		const { patientid, month, date } = request.query;

		const months = {
			january: '1',
			february: '2',
			march: '3',
			april: '4',
			may: '5',
			june: '6',
			july: '7',
			august: '8',
			september: '9',
			october: '10',
			november: '11',
			december: '12',
		};

		let modelQuery = `
			SELECT 
				np.PATIENTID AS patientid,
				b.BILLINGID AS billingid,
				b.OUTSTANDING AS outstanding,
				b.DISCOUNT AS discount,
				b.PAID_AMOUNT AS paid_amount,
				b.PAYABLE AS payable,
				DATE(b.BILLED_ON) as date
			FROM new_patients AS np
			INNER JOIN performing_test as pt ON pt.PATIENTID = np.PATIENTID
			INNER JOIN billing as b ON b.BILLINGID = pt.BILLINGID
		`;



		if (patientid) {
			modelQuery += ` WHERE np.PATIENTID = ${patientid}`;
		}


		if (month && patientid) {
			modelQuery += ` AND MONTH(b.BILLED_ON) = ${months[month]}`;
		} else if (month) {
			modelQuery += ` WHERE MONTH(b.BILLED_ON) = ${months[month]}`
		} else {
			modelQuery = modelQuery
		}

		if ((date && !patientid && !month)) {
			modelQuery += ` WHERE DATE(b.BILLED_ON) = '${date}'`
		} else if ((date && patientid) || (date && month)) {
			modelQuery += ` AND DATE(b.BILLED_ON) = '${date}'`
		} else {
			modelQuery = modelQuery
		}


		modelQuery += `
			ORDER BY b.BILLINGID DESC
			LIMIT 100
		`;

	

		connection.query(modelQuery, (err, result) => {
			if (err) {
				console.log(err);
				response.send({
					statusCode: 500,
					message: 'Internal server error',
				});
			} else {
				response.send({
					result,
					statusCode: 200,
					status: 'success',
				});
			}
		});
	}
}

module.exports = Payment;
