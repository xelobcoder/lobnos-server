
export const q_accountInfo = "SELECT * FROM organizationaccountinformation WHERE organizationid = ?";


export const q_update_org_basic_info = `UPDATE organization
              SET location = ?,
                  street = ?,
                  mobile = ?,
                  address = ?,
                  website = ?,
                  email = ?,
                  gpsmapping = ?,
                  region = ?,
                  name =?,
                  type= ?
              WHERE id = ?;
              `
export const paginated_org_data = `SELECT * FROM organization LIMIT ? OFFSET ?`;

export const q_create_an_organization = `INSERT INTO organization (name, location, street, mobile, address, website, email, gpsmapping, region,type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,?)`


export const q_has_an_organization = `SELECT COUNT(NAME) AS count FROM organization WHERE NAME = ?`


export const q_update_organization_contact_info = `UPDATE organizationcontactperson SET name = ? , email = ?, mobile = ? WHERE organizationid = ?`



export const q_org_payment = `SELECT * FROM organizationaccountinformation WHERE organizationid = ?`


export const q_org_contact = `SELECT * FROM organizationcontactperson WHERE organizationid = ?`


export const q_updateOrg_payment_info = `UPDATE organizationaccountinformation 
          SET
          branch = ?,
          commission = ?,
          account = ?,
          bankname = ?,
          module = ?,
          momoname = ?,
          accountname = ?,
          momo = ? 
          WHERE organizationid = ?`




export const q_organizationid_is_valid = `SELECT * FROM organization WHERE id = ?`;


export const q_load_to_organizationalBilling_Table = `
INSERT INTO organizationalbillingtable (
  priceType,
  organizationid,
  testpricing,
  useCustomLetterHeadings,
  concessionValue,
  concessionMode,
  haveDifferentPriceList,
  hasConcessionAppliedAcross,
  createdby
) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
  priceType = VALUES(priceType)
  testpricing = VALUES(testpricing),
  useCustomLetterHeadings = VALUES(useCustomLetterHeadings),
  concessionValue = VALUES(concessionValue),
  concessionMode = VALUES(concessionMode),
  haveDifferentPriceList = VALUES(haveDifferentPriceList),
  hasConcessionAppliedAcross = VALUES(hasConcessionAppliedAcross),
  createdby = VALUES(createdby);
`;



export const q_load_from_organizationalBilling_Table = `SELECT * FROM organizationalbillingtable WHERE organizationid = ?`



export const q_organization_total_count = `SELECT COUNT(*) AS total FROM organization`;