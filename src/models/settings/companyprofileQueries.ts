export const q_get_company_information = `
  SELECT name, email, motto, phonenumber, address, website, street, alternativenumber, additionalInfo, country_code, state
  FROM companyprofile
`;

export const q_insert_into_company_information = `
  INSERT INTO companyprofile (name, email, motto, phonenumber, address, website, street, alternativenumber) 
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`;

export const q_truncate_company_information = `
  TRUNCATE TABLE companyprofile
`;
