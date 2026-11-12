import { requireStrongPassword } from '../../auth/PasswordPolicy';
import bcrypt from "bcrypt";
export interface IEmployee {
	employeeid?: number;
	username: string;
	role: 'cashier' | 'pharmacist' | 'doctor' | 'medical_officer' | 'consultant' | 'nurse' | 'pharmacy_doctor' | 'pharmacy_nurse' | 'marketer' | 'scientist' | 'sonographer' | 'head_of_laboratory' | 'head_of_imaging' | 'admin' | 'manager' | 'phelobotomist' | 'pharmacy_accountant' | 'pharmacy_cashier' | 'pharmacy_manager' | 'pharmacy_storekeeper' | 'pharmacy_dispensary_officer';
	password: string;
	pin?: number | string | null;
	pin_hash?: string | null;
	date_created?: string | Date,
	time?: string;
	refresh_token?: string | null;
	activation: number;
	email: string;
	updated_on?: string | Date,
	emailAuthenticated: string;
	branch?: number | null;
	mobile: string;
	alternativeMobile?: string | null;
	dob?: string | null;
	firstname?: string | null;
	middlename?: string | null;
	lastname?: string | null;
	staff_designation?: string | null;
	permissions?: unknown;
}
import KnexConnection from "../../../database/KnexConnections";
import { roleAllowed } from "../../../middleware/roles";
import logger from "../../../hooks/logger";
import {revokePasswordSessions} from '../../auth/passwordSessions';


export default class RolesRepository {
	private connection;
	private tablename: string = 'roles';

	constructor(tenantId: number) {
		this.connection = KnexConnection(tenantId);
		this.tablename = "roles";
	}
	public async hashPassword(password: string): Promise<string> {
		requireStrongPassword(password);
		const salt = await bcrypt.genSalt(10);
		const hashed = await bcrypt.hash(password, salt);
		return hashed;
	}

	public async isPasswordSame(password: string, hashpassword: string): Promise<boolean> {
		return await bcrypt.compare(password, hashpassword);
	}

	async createRole(roleData: IEmployee): Promise<number> {
		try {
			// The UI label may arrive capitalized; persist the canonical billing role.
			if (typeof roleData.role === 'string' && roleData.role.trim().toLowerCase() === 'cashier') {
				roleData = { ...roleData, role: 'cashier' };
			}
			const allowedRoles = ['cashier','pharmacist','doctor','medical_officer','consultant','nurse','pharmacy_doctor','pharmacy_nurse','marketer', 'scientist', 'sonographer', 'head_of_laboratory', 'head_of_imaging', 'admin', 'manager', 'phelobotomist', 'customer service representative', 'pharmacy_accountant', 'pharmacy_cashier', 'pharmacy_manager', 'pharmacy_storekeeper', 'pharmacy_dispensary_officer'];
			if (!roleData.username || typeof roleData.username !== 'string') throw new Error('Invalid username');
			if (!allowedRoles.includes(roleData.role)) throw new Error('Invalid role');
			if (!roleData.password || typeof roleData.password !== 'string') throw new Error('Invalid password');
			if (!roleData.email || typeof roleData.email !== 'string') throw new Error('Invalid email');
			const pin = String(roleData.pin || '');
			if (!/^\d{4}$/.test(pin)) throw new Error('Invalid pin');
			if (!roleData.mobile || typeof roleData.mobile !== 'string' || roleData.mobile.length < 7) throw new Error('Invalid mobile');
			const connection = await this.connection;
			const result = await connection(this.tablename).insert({ ...roleData, pin: null, pin_hash: await bcrypt.hash(pin, 10) }).returning('employeeid');
			return result[0];
		} catch (error: any) {
			logger.log(error);
			throw new Error('Failed to create role: ' + error.message);
		}
	}

	async getRoleById(employeeId: number): Promise<IEmployee | undefined> {
		const connection = await this.connection;
		const result = await connection(this.tablename).where({ employeeid: employeeId }).first();
		return result;
	}

	async getRoleByEmail(email: string): Promise<IEmployee> {
		const connection = await this.connection;
		const result = await connection(this.tablename).where({ email: email }).first();
		return result;
	}

	async verifyMobileNumber(mobile: string): Promise<IEmployee | undefined> {
		const connection = await this.connection;
		const result = await connection(this.tablename).where({ mobile }).first();
		return result;
	}

	async isRoleValid(expectedRole: IEmployee['role'], employeeId: number): Promise<boolean> {
		const connection = await this.connection;
		const result = await connection(this.tablename).where({ employeeid: employeeId }).first();
		return result && result.role === expectedRole;
	}

	async updateRole(employeeId: number, roleData: Partial<IEmployee>): Promise<number> {
		const connection = await this.connection;
		return connection.transaction(async trx=>{
			const current=await trx(this.tablename).where({employeeid:employeeId}).forUpdate().first();
			if(!current)return 0;
			const changingAccess=(roleData.role!==undefined&&roleData.role!==current.role)||(roleData.branch!==undefined&&Number(roleData.branch)!==Number(current.branch));
			if(changingAccess&&await trx('staff_role_access').where({employeeid:employeeId}).first())throw new Error('Manage this employee’s roles and locations through Staff & role access. Add or remove assignments there.');
			const changingSession=changingAccess||(roleData.activation!==undefined&&Number(roleData.activation)!==Number(current.activation));
			if(roleData.activation!==undefined&&Number(roleData.activation)!==Number(current.activation))await revokePasswordSessions(trx,'staff',employeeId);
			return trx(this.tablename).where({employeeid:employeeId}).update({...roleData,...(changingSession?{access_revision:Number(current.access_revision||0)+1}:{})});
		});
	}

	async deleteRole(employeeId: number): Promise<number> {
		const connection = await this.connection;
		const result = await connection(this.tablename).where({ employeeid: employeeId }).del()
		return result
	}

	async getAllRoles(): Promise<IEmployee[]> {
		const connection = await this.connection;
		const result = await connection(this.tablename).select('*');
		return result;
	}

	async getEmployeeRole(employeeId: number): Promise<IEmployee['role'] | undefined> {
		const employee = await this.getRoleById(employeeId);
		const allowedRoles = ['cashier','marketer', 'scientist', 'sonographer', 'head_of_laboratory', 'head_of_imaging', 'admin', 'manager', 'phelobotomist', 'super_admin', 'pharmacy_accountant', 'pharmacy_cashier', 'pharmacy_manager', 'pharmacy_storekeeper', 'pharmacy_dispensary_officer'];
		return employee && roleAllowed(employee.role, allowedRoles) ? employee.role as IEmployee['role'] : undefined;
	}
	async validatePin(employeeId: number, pin: string): Promise<boolean> {
		const employee = await this.getRoleById(employeeId);
		if (!employee || !/^\d{4}$/.test(String(pin))) return false;
		if (employee.pin_hash) return bcrypt.compare(String(pin), employee.pin_hash);
		if (employee.pin == null || String(employee.pin) !== String(pin)) return false;
		const connection = await this.connection;
		const pinHash = await bcrypt.hash(String(pin), 10);
		await connection(this.tablename).where({ employeeid: employeeId, pin: employee.pin }).whereNull('pin_hash').update({ pin_hash: pinHash, pin: null });
		return true;
	}


	async getEmployeesList(employeelist: number[]): Promise<IEmployee[] | undefined> {
		const stringedValues = Array.isArray(employeelist) && employeelist.length > 0;
		if (stringedValues) {
			const connection = await this.connection;
			const result = await connection(this.tablename).whereIn('employeeid', employeelist);
			return result;
		}
	}

}
