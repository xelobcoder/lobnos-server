"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.q_organization_total_count = exports.q_load_from_organizationalBilling_Table = exports.q_load_to_organizationalBilling_Table = exports.q_organizationid_is_valid = exports.q_updateOrg_payment_info = exports.q_org_contact = exports.q_org_payment = exports.q_update_organization_contact_info = exports.q_has_an_organization = exports.q_create_an_organization = exports.paginated_org_data = exports.q_update_org_basic_info = exports.q_accountInfo = void 0;
exports.q_accountInfo = "SELECT * FROM organizationaccountinformation WHERE organizationid = ?";
exports.q_update_org_basic_info = `UPDATE organization
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
              `;
exports.paginated_org_data = `SELECT * FROM organization LIMIT ? OFFSET ?`;
exports.q_create_an_organization = `INSERT INTO organization (name, location, street, mobile, address, website, email, gpsmapping, region,type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,?)`;
exports.q_has_an_organization = `SELECT COUNT(NAME) AS count FROM organization WHERE NAME = ?`;
exports.q_update_organization_contact_info = `UPDATE organizationcontactperson SET name = ? , email = ?, mobile = ? WHERE organizationid = ?`;
exports.q_org_payment = `SELECT * FROM organizationaccountinformation WHERE organizationid = ?`;
exports.q_org_contact = `SELECT * FROM organizationcontactperson WHERE organizationid = ?`;
exports.q_updateOrg_payment_info = `UPDATE organizationaccountinformation 
          SET
          branch = ?,
          commission = ?,
          account = ?,
          bankname = ?,
          module = ?,
          momoname = ?,
          accountname = ?,
          momo = ? 
          WHERE organizationid = ?`;
exports.q_organizationid_is_valid = `SELECT * FROM organization WHERE id = ?`;
exports.q_load_to_organizationalBilling_Table = `
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
exports.q_load_from_organizationalBilling_Table = `SELECT * FROM organizationalBillingtable WHERE organizationid = ?`;
exports.q_organization_total_count = `SELECT COUNT(*) AS total FROM organization`;
