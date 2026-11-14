import type { Knex } from "knex";
import type { PatientPhoneContactDto } from "../patients/dto/patientPhoneContact.dto";
import { normalizeRegistrationPhone } from "../patients/dto/checkMobileNoDto.dto";

export const phoneContactsTable = "patient_phone_contacts";

export class PatientPhoneContactError extends Error {}

export async function findPhoneOwners(db: Knex, phone: string, excludePatientId?: number) {
     return db("new_patients as patient")
          .where((query) =>
               query
                    .where({ "patient.mobile_number": phone, "patient.contactpointer": "self" })
                    .orWhere({ "patient.backup_phone": phone, "patient.backup_relationship": "self" })
                    .orWhereExists(
                         db(phoneContactsTable)
                              .select("patient_id")
                              .whereRaw("?? = ??", ["patient_id", "patient.patientid"])
                              .where("position", ">=", 2)
                              .where({ phone, relationship: "self" }),
                    ),
          )
          .modify((query) => {
               if (excludePatientId !== undefined) query.whereNot("patient.patientid", excludePatientId);
          })
          .select("patient.patientid", "patient.firstname", "patient.middlename", "patient.lastname")
          .limit(2);
}

export async function getAdditionalPhoneContacts(db: Knex, patientId: number) {
     return db(phoneContactsTable)
          .where("patient_id", patientId)
          .where("position", ">=", 2)
          .orderBy("position")
          .select("phone", "relationship", "contact_name", "owner_patient_id");
}

export async function savePatientPhoneContacts(db: Knex, patientId: number, additional?: PatientPhoneContactDto[]) {
     const patient = await db("new_patients").where("patientid", patientId).first();
     if (!patient) return;
     const primary = patient.contactpointer === "relative" ? patient.relativecontactnumber : patient.mobile_number;
     const rows: Array<PatientPhoneContactDto & { patient_id: number; position: number }> = [];
     const primaryOwners =
          primary && patient.contactpointer === "relative" ? await findPhoneOwners(db, primary, patientId) : [];
     if (primary)
          rows.push({
               patient_id: patientId,
               position: 0,
               phone: primary,
               relationship:
                    patient.contactpointer === "relative" ? patient.contact_relationship || "relative" : "self",
               contact_name: patient.contactpointer === "relative" ? patient.relativecontactname : null,
               owner_patient_id: primaryOwners.length === 1 ? Number(primaryOwners[0].patientid) : null,
          });
     if (patient.backup_phone)
          rows.push({
               patient_id: patientId,
               position: 1,
               phone: patient.backup_phone,
               relationship: patient.backup_relationship || "relative",
               contact_name: patient.backup_contact_name,
               owner_patient_id: patient.backup_patient_id,
          });

     if (additional) {
          const seen = new Set(rows.map((row) => normalizeRegistrationPhone(row.phone) ?? row.phone));
          for (const [index, contact] of additional.entries()) {
               const phone = normalizeRegistrationPhone(contact.phone);
               if (!phone || !/^\d{10,15}$/.test(phone) || seen.has(phone)) {
                    throw new PatientPhoneContactError("Enter a different, valid number for each contact.");
               }
               seen.add(phone);
               const owners = await findPhoneOwners(db, phone, patientId);
               let name = contact.contact_name?.trim() || null;
               let ownerId = null;
               if (contact.relationship === "self") {
                    if (owners.length || contact.owner_patient_id) {
                         throw new PatientPhoneContactError(
                              "Another patient owns this number. Add it as a relative or other contact.",
                         );
                    }
                    name = null;
               } else {
                    const owner = owners.length === 1 ? owners[0] : null;
                    if (contact.owner_patient_id && Number(owner?.patientid) !== Number(contact.owner_patient_id)) {
                         throw new PatientPhoneContactError(
                              "The selected patient no longer owns this number. Check the contact before saving.",
                         );
                    }
                    if (owner) {
                         ownerId = Number(owner.patientid);
                         name = [owner.firstname, owner.middlename, owner.lastname].filter(Boolean).join(" ");
                    }
                    if (!name) throw new PatientPhoneContactError("Enter the name of the person who owns the number.");
               }
               rows.push({
                    patient_id: patientId,
                    position: index + 2,
                    phone,
                    relationship: contact.relationship,
                    contact_name: name,
                    owner_patient_id: ownerId,
               });
          }
     }
     await db(phoneContactsTable)
          .where("patient_id", patientId)
          .modify((query) => {
               if (!additional) query.where("position", "<", 2);
          })
          .delete();
     if (rows.length) await db(phoneContactsTable).insert(rows);
}
