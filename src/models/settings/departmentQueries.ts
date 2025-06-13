export const INSERT_DEPARTMENT = `
  INSERT INTO departments (department, departmentManager, employeeid) VALUES (?, ?, ?)
`;

export const SELECT_ALL_DEPARTMENTS = `
  SELECT * FROM departments ORDER BY id DESC LIMIT 50
`;

export const UPDATE_DEPARTMENT = `
  UPDATE departments SET department = ?, departmentManager = ?, employeeid = ? WHERE id = ?
`;

export const DELETE_DEPARTMENT = `
  DELETE FROM departments WHERE id = ?
`;

export const SELECT_DEPARTMENT_BY_ID = `
  SELECT * FROM departments WHERE id = ?
`;
