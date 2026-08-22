import logger from "../../hooks/logger";
import bcrypt from "bcrypt";
import User from "../../LobnosAuth/user";
import Registration from "../registration/registration";
import { PatientQuery } from "./queries";
import { promisifyQuery, customError, convertKeysToLowerCase, rowAffected } from "../../hooks/helper";
import { OperationsFailures } from "../operations/types";
import databaseQueries from "../../database/DatabaseQueriesHelper";
import { UpdateCredentialsRequest } from './types';
import { IPatient } from "./PtInterface";
import { PrimeLimsTablepatients_credentials } from "../../database/DatabaseTableSchema";
import PatientImageRepository from "../../repositories/patientRepositories/PatientImageRepository";
import KnexConnection from "../../database/KnexConnections";

class Patient extends Registration implements IPatient {
	constructor(patientid: number) {
		super();
	}

	private runqueryPromise = promisifyQuery;


	public static async checkNumberBelongsToPatient(tenantId: number, patientid: number, mobileno: number | string): Promise<boolean> {
		const connection = await KnexConnection(tenantId);
		const result = await connection("new_patients")
			.where("patientid", patientid)
			.andWhere("mobile_number", mobileno)
			.first();
		return result ? true : false;
	}


	async getTransactionsByDate(tenantId: number, patientid: number, to?: string, from?: string): Promise<any> {
		const isPatientExists = await Registration.checkPatientIdExist(tenantId, patientid);
		if (isPatientExists) {
			let query = PatientQuery.getTransactionsByDate;
			let values: [number] | [number, string, string] = [patientid];
			if (from && to) {
				query += ` AND DATE BETWEEN ? AND ?`;
				values = [...values, from, to];
			}
			return this.runqueryPromise(tenantId, query, values);
		} else {
			return OperationsFailures.notFound
		}
	}


	private async updatePatientPassWordCredential(username: string, npassword: string, tenantId: number, patientid: number): Promise<boolean> {
		const hashedPassword = await new User(username, npassword, null, null, null).hashPassword();
		const updateQuery = PatientQuery.updateCredentials;
		try {
			const result = await this.runqueryPromise(tenantId,
				updateQuery, [username, hashedPassword, patientid]);
			return rowAffected(result);
		} catch (err) {
			logger.error(err);
			throw new Error("Failed to update patient credentials");
		}
	}

	async updateNotificationSettings(tenantId: number, data:any): Promise<boolean> {
		const { mode, method, notify, patientid } = data
		const updateQuery = PatientQuery.updateNotificationSettings;
		const updated = await this.runqueryPromise(tenantId, updateQuery, [mode, method, notify, parseInt(patientid)]);
		return rowAffected(updated)
	}

	async transformDataset(list: any[], data: any[]): Promise<any> {
		return list
			.map((item, index) => {
				const filtered = data.filter((e, i) => {
					if (e.billingid == parseInt(item)) {
						return convertKeysToLowerCase(e);
					}
				});
				return { billingid: item, data: filtered, date: filtered.length > 0 ? filtered[0]["created_on"] : null };
			})
			.sort((a, b) => {
				return new Date(a.date).getTime() - new Date(b.date).getTime();
			});
	}

	async getParameters(data: any[]): Promise<any> {
		let parameters = [];
		data.map((item, index) => {
			if (!parameters.includes(item?.parameter)) {
				parameters.push(item?.parameter);
			}
		});
		return parameters;
	}



	async getPatientNotificationSettings(tenantId: number, patientid: number): Promise<PrimeLimsTablepatients_credentials | null> {
		const notications = await promisifyQuery(tenantId, PatientQuery.getPatientNotificationSettings, [patientid]);
		return notications.length > 0 ? notications[0] : null;
	}

	async updatePatientImage(tenantId: number, patientId: number, imagePath: string): Promise<boolean> {
		try {
			const hasImage = await PatientImageRepository.findByPatientId(tenantId, patientId);
			if (hasImage) {
				return await PatientImageRepository.update(tenantId, patientId, imagePath);
			} else {
				return await PatientImageRepository.create(tenantId, patientId, imagePath);
			}
		} catch (error) {
			logger.error(error);
			throw new Error("Failed to update patient image");
		}
	}
}

export default Patient;
