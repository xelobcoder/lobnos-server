import KnexConnection from "../../../database/KnexConnections";

type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE';

export type RolesAuditLogRow = {
	id: number;
	action: AuditAction;
	employeeid: number;
	actor_employeeid: number | null;
	old_data: any | null;
	new_data: any | null;
	created_at: string;
};

export default class RolesAuditRepository {
	static sanitizeRoleRow(row: any): any {
		if (!row) return null;
		const {
			password,
			refresh_token,
			pin,
			pin_hash,
			...rest
		} = row;
		return rest;
	}

	static async insertAudit(opts: {
		tenantId: number;
		action: AuditAction;
		employeeid: number;
		actorEmployeeid?: number | null;
		oldData?: any | null;
		newData?: any | null;
		trx?: any;
	}): Promise<void> {
		const { tenantId, action, employeeid, actorEmployeeid, oldData, newData, trx } = opts;
		const conn = trx || (await KnexConnection(tenantId));
		await conn("roles_audit_log").insert({
			action,
			employeeid,
			actor_employeeid: actorEmployeeid ?? null,
			old_data: oldData == null ? null : JSON.stringify(oldData),
			new_data: newData == null ? null : JSON.stringify(newData),
			created_at: conn.fn.now(6)
		});
	}
}

