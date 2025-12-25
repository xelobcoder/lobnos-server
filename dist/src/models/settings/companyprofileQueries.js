"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.q_truncate_company_information = exports.q_insert_into_company_information = exports.q_get_company_information = void 0;
exports.q_get_company_information = `
  SELECT name, email, motto, phonenumber, address, website, street, alternativenumber, additionalInfo
  FROM companyprofile
`;
exports.q_insert_into_company_information = `
  INSERT INTO companyprofile (name, email, motto, phonenumber, address, website, street, alternativenumber) 
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`;
exports.q_truncate_company_information = `
  TRUNCATE TABLE companyprofile
`;
