export const q_add_new_branch = `INSERT INTO branch (name, address, email, contact, managerid) VALUES (?, ?, ?, ?, ?)`

export const q_branches_get_single = `SELECT * FROM branch ORDER BY branchid ASC LIMIT ? OFFSET ?`;

export const q_branches_get_all = `SELECT * FROM branch WHERE branchid = ?`

export const q_branches_update_single = `UPDATE branch SET name = ?, contact = ?, address = ?, email = ?, managerid = ? WHERE branchid = ?`

export const q_branches_delete_single = `DELETE FROM BRANCH WHERE branchid = ?`

export const q_update_activation =
     `UPDATE branch SET activation = ? WHERE branchid = ?`;



     export const g_get_branch = `SELECT * FROM BRANCH WHERE branchid = ? LIMIT 1 `;