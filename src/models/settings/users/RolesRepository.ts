import bcrypt from "bcrypt";
export interface IEmployee {
	employeeid?: number;
	username: string;
	role: 'scientist' | 'sonographer' | 'admin' | 'manager' | 'phelobotomist';
	password: string;
	pin: number;
	date_created?: string;
	time?: string;
	refresh_token?: string | null;
	activation: number;
	email: string;
	permissions?: string;
	updated_on?: string | null;
	emailAuthenticated: string;
	branch?: number | null;
	mobile: string;
	alternativeMobile?: string | null;
	dob?: string | null;
}
import KnexConnection from "../../../database/KnexConnections";
import logger from "../../../hooks/logger";


export default class RolesRepository {

	private connection;
	private tablename: string = 'roles';

	constructor(tenantId: number) {
		this.connection = KnexConnection(tenantId);
		this.tablename = "roles";
	}
	public async hashPassword(password: string): Promise<string> {
		const salt = await bcrypt.genSalt(10);
		const hashed = await bcrypt.hash(password, salt);
		return hashed;
	}

	public async isPasswordSame(password: string, hashpassword: string): Promise<boolean> {
		return await bcrypt.compare(password, hashpassword);
	}

	async createRole(roleData: IEmployee): Promise<number> {
		try {
			const allowedRoles = ['scientist', 'sonographer', 'admin', 'manager', 'phelobotomist', 'customer service representative'];
			if (!roleData.username || typeof roleData.username !== 'string') throw new Error('Invalid username');
			if (!allowedRoles.includes(roleData.role)) throw new Error('Invalid role');
			if (!roleData.password || typeof roleData.password !== 'string') throw new Error('Invalid password');
			if (!roleData.email || typeof roleData.email !== 'string') throw new Error('Invalid email');
			if (typeof roleData.pin !== 'number' || roleData.pin.toString().length !== 4) throw new Error('Invalid pin');
			if (!roleData.mobile || typeof roleData.mobile !== 'string' || roleData.mobile.length < 7) throw new Error('Invalid mobile');
			const connection = await this.connection;
			const result = await connection(this.tablename).insert(roleData).returning('employeeid');
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
		const result = await connection(this.tablename).where({ employeeid: employeeId }).update(roleData);
		return result;
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
		const allowedRoles = ['scientist', 'sonographer', 'admin', 'manager', 'phelobotomist','super_admin'];
		return employee && allowedRoles.includes(employee.role) ? employee.role as IEmployee['role'] : undefined;
	}
	async validatePin(employeeId: number, pin: string): Promise<boolean> {
		const employee = await this.getRoleById(employeeId);
		if (!employee?.pin) return false;
		const characters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];
		if (typeof pin === 'string' && characters.some(char => pin.toLowerCase().includes(char))) return false;
		return employee.pin.toString() === parseInt(pin).toString();
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