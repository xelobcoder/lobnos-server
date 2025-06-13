export const q_tiifu_findColumn = `SELECT * FROM tableName WHERE columnName = ? LIMIT 1`;

export const q_tiifu_findColumn_many = `SELECT * FROM tableName WHERE columnName = ?`;

export const q_tiifu_find_many_using_list_in = `SELECT * FROM tableName WHERE columnName IN (list)`


export const q_tiifu_add_new_column = `ALTER TABLE {tablename} ADD COLUMN {columnName} {constraint}`;


export const q_check_duplicate = (type: string, table: string, id: number, columnName: string, date: string) =>
     `SELECT * FROM ${table} WHERE created_on = '${date}' AND ${columnName} = ${id}`;

export const q_delete_single = (id: number, table: string, idResolver: string) =>
     `DELETE FROM ${table} WHERE ${idResolver} = ${id}`;

export const q_delete_many = (deleteArray: number[], table: string) =>
     `DELETE FROM ${table} WHERE id IN (${deleteArray.join(',')})`;

export const q_get_all = (table: string, limit: number) =>
     `SELECT * FROM ${table} ORDER BY id DESC LIMIT ${limit}`;

export const q_get_single_role = (id: number) =>
     `SELECT * FROM roles WHERE roleid = ${id}`;

export const q_new_role = (fullname: string, username: string, password: string, role: string) =>
     `INSERT INTO roles (fullname, username, role, password) VALUES(?, ?, ?, ?)`;

export const q_update_role = (fullname: string, username: string, role: string, password: string, roleid: number) =>
     `UPDATE roles SET fullname = '${fullname}', username = '${username}', password = '${password}', role = '${role}' WHERE roleid = ${roleid}`;

export const q_delete_role = (id: number) =>
     `DELETE FROM roles WHERE roleid = ${id}`;

export const q_truncate_table = (tablename: string) =>
     `TRUNCATE TABLE ${tablename}`;



