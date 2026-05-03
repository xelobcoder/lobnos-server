"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SELECT_DEPARTMENT_BY_ID = exports.DELETE_DEPARTMENT = exports.UPDATE_DEPARTMENT = exports.SELECT_ALL_DEPARTMENTS = exports.INSERT_DEPARTMENT = void 0;
exports.INSERT_DEPARTMENT = `
  INSERT INTO departments (department, departmentManager, employeeid) VALUES (?, ?, ?)
`;
exports.SELECT_ALL_DEPARTMENTS = `
  SELECT * FROM departments ORDER BY id DESC LIMIT 50
`;
exports.UPDATE_DEPARTMENT = `
  UPDATE departments SET department = ?, departmentManager = ?, employeeid = ? WHERE id = ?
`;
exports.DELETE_DEPARTMENT = `
  DELETE FROM departments WHERE id = ?
`;
exports.SELECT_DEPARTMENT_BY_ID = `
  SELECT * FROM departments WHERE id = ?
`;
