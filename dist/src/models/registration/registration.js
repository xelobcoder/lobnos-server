"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const TiifuWorkingClass_1 = require("../../database/TiifuWorkingClass");
const appLevelTriggers_1 = require("../../database/appLevelTriggers");
const helper_1 = require("../../hooks/helper");
const logger_1 = __importDefault(require("../../hooks/logger"));
const appset_1 = __importDefault(require("../application/appsettings/appset"));
const PrimeEventsDataSource_1 = require("../application/sms/events/PrimeEventsDataSource");
const queries_1 = require("./queries");
class Registration {
    static normalizePhoneTo10(value) {
        if (value === undefined || value === null)
            return null;
        const raw = String(value).trim();
        if (!raw)
            return null;
        const digits = raw.replace(/\D/g, "");
        if (!digits)
            return null;
        if (digits.length > 10)
            return digits.slice(-10);
        return digits;
    }
    static serializeAuditRecord(record) {
        if (!record || typeof record !== "object")
            return record;
        const normalized = Object.assign({}, record);
        Object.keys(normalized).forEach((key) => {
            const value = normalized[key];
            if (value instanceof Date) {
                normalized[key] = value.toISOString();
            }
        });
        return normalized;
    }
    static buildPatientChangedFields(previousData, newData) {
        var _a, _b;
        const previous = Registration.serializeAuditRecord(previousData) || {};
        const current = Registration.serializeAuditRecord(newData) || {};
        const keys = new Set([...Object.keys(previous), ...Object.keys(current)]);
        const ignoredKeys = new Set(['date']);
        const changedFields = [];
        for (const key of keys) {
            if (ignoredKeys.has(key))
                continue;
            const oldValue = (_a = previous[key]) !== null && _a !== void 0 ? _a : null;
            const newValue = (_b = current[key]) !== null && _b !== void 0 ? _b : null;
            if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
                changedFields.push({ field: key, oldValue, newValue });
            }
        }
        return changedFields;
    }
    static async createPatientAuditLog(tenantId, payload) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u;
        const changedFields = Registration.buildPatientChangedFields(payload.previousData, payload.newData);
        if (changedFields.length === 0)
            return false;
        const conn = await (0, KnexConnections_1.default)(tenantId);
        const snapshot = payload.newData && typeof payload.newData === 'object' ? payload.newData : {};
        try {
            await conn('patient_audit_log').insert({
                auditid: conn.raw('UUID()'),
                patientid: (_a = snapshot.patientid) !== null && _a !== void 0 ? _a : payload.patientid,
                fullpatientid: snapshot.fullpatientid,
                designation: (_b = snapshot.designation) !== null && _b !== void 0 ? _b : null,
                firstname: snapshot.firstname,
                email: (_c = snapshot.email) !== null && _c !== void 0 ? _c : null,
                dob: (_d = snapshot.dob) !== null && _d !== void 0 ? _d : null,
                age: snapshot.age,
                gender: (_e = snapshot.gender) !== null && _e !== void 0 ? _e : null,
                marital_status: (_f = snapshot.marital_status) !== null && _f !== void 0 ? _f : null,
                mobile_number: (_g = snapshot.mobile_number) !== null && _g !== void 0 ? _g : null,
                agetype: snapshot.agetype,
                occupation: (_h = snapshot.occupation) !== null && _h !== void 0 ? _h : null,
                date: (_j = snapshot.date) !== null && _j !== void 0 ? _j : conn.fn.now(),
                activation_status: (_k = snapshot.activation_status) !== null && _k !== void 0 ? _k : 'FALSE',
                lastname: snapshot.lastname,
                middlename: (_l = snapshot.middlename) !== null && _l !== void 0 ? _l : null,
                organization: (_m = snapshot.organization) !== null && _m !== void 0 ? _m : null,
                contactpointer: (_o = snapshot.contactpointer) !== null && _o !== void 0 ? _o : 'self',
                whatAppcontact: (_p = snapshot.whatAppcontact) !== null && _p !== void 0 ? _p : null,
                registeredby: snapshot.registeredby,
                relativecontactname: (_q = snapshot.relativecontactname) !== null && _q !== void 0 ? _q : null,
                relativecontactnumber: (_r = snapshot.relativecontactnumber) !== null && _r !== void 0 ? _r : null,
                whatsapp_country_code: (_s = snapshot.whatsapp_country_code) !== null && _s !== void 0 ? _s : null,
                mobile_country_code: (_t = snapshot.mobile_country_code) !== null && _t !== void 0 ? _t : null,
                section: payload.section,
                action_type: payload.actionType,
                changed_by_employeeid: (_u = payload.changedByEmployeeId) !== null && _u !== void 0 ? _u : null,
                changed_fields: JSON.stringify(changedFields),
                changed_at: conn.fn.now()
            });
        }
        catch (_v) {
            return false;
        }
        return true;
    }
    static async getPatientAuditHistory(tenantId, patientid) {
        const conn = await (0, KnexConnections_1.default)(tenantId);
        const hasAuditTable = await conn.schema.hasTable('patient_audit_log');
        if (!hasAuditTable)
            return [];
        const rows = await conn('patient_audit_log')
            .leftJoin('roles', 'patient_audit_log.changed_by_employeeid', 'roles.employeeid')
            .select('patient_audit_log.*', 'roles.username as changed_by_username', 'roles.role as changed_by_role')
            .where('patient_audit_log.patientid', patientid)
            .orderBy('patient_audit_log.changed_at', 'desc');
        return rows.map((row) => (Object.assign(Object.assign({}, row), { changed_fields: (() => {
                if (row.changed_fields === undefined || row.changed_fields === null)
                    return [];
                if (typeof row.changed_fields === 'string') {
                    try {
                        return JSON.parse(row.changed_fields);
                    }
                    catch (_a) {
                        return [];
                    }
                }
                return row.changed_fields;
            })() })));
    }
    static getMissingRequiredPatientField(records) {
        const requiredFields = ["firstname", "lastname", "gender", "age", "ageType"];
        for (const field of requiredFields) {
            const value = records[field];
            if (value === undefined || value === null)
                return field;
            if (typeof value === "string" && value.trim() === "")
                return field;
        }
        return null;
    }
    static async getPatientID(tenantId, patientid) {
        if (typeof patientid !== "number") {
            throw new TypeError("number required as insertedId");
        }
        const information = await new TiifuWorkingClass_1.TiifuWorkingClass("new_patients").findOne(tenantId, "patientid", patientid);
        if (!information)
            return null;
        return information.patientid;
    }
    static patientsInformationBatch(tenantId, page, count) {
        return (0, helper_1.promisifyQuery)(tenantId, queries_1.q_patient_info_pagination, [count, page]);
    }
    static async getTotalPatients(tenantId) {
        const totalPatients = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_totalpatientcountQuery);
        if (totalPatients.length > 0) {
            return totalPatients[0].total;
        }
        return 0;
    }
    static async generatePatientFullUniqueId(tenantId) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const lastPatient = await connection("new_patients")
            .select("patientid")
            .orderBy("patientid", "desc")
            .first();
        const lastId = lastPatient ? lastPatient.patientid + 1 : 1;
        const paddedId = String(lastId).padStart(6, "0");
        const codeValues = await appset_1.default.getLabRegionalAndDistrictCodeAbbreviations(tenantId);
        if (!codeValues)
            return null;
        return `${codeValues.region}-${paddedId}-${codeValues.district}`;
    }
    static async getPatientDataUsingPatientId(tenantId, patientid) {
        if (!patientid)
            return "No Arguments Provided" /* OperationsFailures.noArgumentsProvided */;
        return await new TiifuWorkingClass_1.TiifuWorkingClass("new_patients").findOne(tenantId, "patientid", patientid);
    }
    checkEmailOrMobileExist(tenantId, email, mobile) {
        throw new Error("Method not implemented.");
    }
    static registeredPatientIdOnDatabaseTable(tenantId, generatedId) {
        throw new Error("Method not implemented.");
    }
    static async checkPatientIdExist(tenantId, patientid) {
        let result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_patient_data, [patientid]);
        return result.length > 0;
    }
    async getPatientBasicData(tenantId, patientid) {
        const rows = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_patient_data, [patientid]);
        return rows.length > 0 ? rows[0] : null;
    }
    static async addPersonalInformation(tenantId, records) {
        try {
            const missingField = this.getMissingRequiredPatientField(records);
            if (missingField) {
                return `${missingField} is required`;
            }
            const generatedId = await this.generatePatientFullUniqueId(tenantId);
            const removeCountryCodeFromMobile = (mobile, countryCode) => {
                const mobileStr = String(mobile).trim();
                if (mobileStr.startsWith(countryCode)) {
                    return mobileStr.slice(countryCode.length);
                }
                return mobileStr;
            };
            if (generatedId) {
                const sanitizedMobileNumber = removeCountryCodeFromMobile(records.mobile, records.mobileCountryCode);
                const sanitizedWhatsApp = removeCountryCodeFromMobile(records.whatAppcontact, records.whatsappCountryCode);
                const sanitizedRelativeContact = removeCountryCodeFromMobile(records.relativecontactnumber, records.relativeCountryCode);
                const { designation, firstname, lastname, middlename, age, ageType, gender, employeeid, relativecontactname, email, days, mobileCountryCode, whatsappCountryCode, relativeCountryCode, months, maritalstatus, occupation, patientOrganization, years, mobileownership = "self", } = records;
                let mobileStr = undefined;
                if (sanitizedMobileNumber) {
                    if (typeof sanitizedMobileNumber === 'string') {
                        mobileStr = String(sanitizedMobileNumber).trim();
                    }
                    else if (typeof sanitizedMobileNumber === 'number' && !isNaN(sanitizedMobileNumber)) {
                        mobileStr = sanitizedMobileNumber;
                    }
                }
                if (mobileownership === 'self' && mobileStr && mobileStr.length > 0) {
                    const existingSelf = await (0, helper_1.promisifyQuery)(tenantId, `SELECT patientid FROM new_patients WHERE mobile_number = ? AND contactpointer = 'self'`, [mobileStr]);
                    if (existingSelf && existingSelf.length > 0) {
                        return 'A primary (self) contact already exists for this mobile number.';
                    }
                }
                const persistedMobileNumber = mobileownership === 'relative' ? null : sanitizedMobileNumber;
                const parsedYear = !isNaN(years) ? parseInt(years.toString()) : 0;
                const parsedMonth = !isNaN(months) ? parseInt(months.toString()) : 0;
                const parsedDay = !isNaN(days) ? parseInt(days.toString()) : 0;
                const isCorrectDOB = (parsedYear > 0 && parsedMonth > 0 && parsedDay > 0);
                const dob = isCorrectDOB ? `${parsedYear}-${parsedMonth}-${parsedDay}` : null;
                const connection = await (0, KnexConnections_1.default)(tenantId);
                const createdPatientId = await connection.transaction(async (trx) => {
                    const insertOutcome = await trx("new_patients").insert({
                        firstname,
                        lastname,
                        middlename: middlename !== null && middlename !== void 0 ? middlename : null,
                        email: email !== null && email !== void 0 ? email : null,
                        age,
                        agetype: ageType,
                        dob,
                        marital_status: maritalstatus !== null && maritalstatus !== void 0 ? maritalstatus : null,
                        mobile_number: persistedMobileNumber,
                        occupation: occupation !== null && occupation !== void 0 ? occupation : null,
                        gender: gender !== null && gender !== void 0 ? gender : null,
                        organization: patientOrganization !== null && patientOrganization !== void 0 ? patientOrganization : null,
                        fullpatientid: generatedId,
                        contactpointer: mobileownership,
                        designation: designation !== null && designation !== void 0 ? designation : null,
                        registeredby: employeeid,
                        relativecontactname: relativecontactname !== null && relativecontactname !== void 0 ? relativecontactname : null,
                        relativecontactnumber: sanitizedRelativeContact !== null && sanitizedRelativeContact !== void 0 ? sanitizedRelativeContact : null,
                        whatsapp_country_code: whatsappCountryCode !== null && whatsappCountryCode !== void 0 ? whatsappCountryCode : null,
                        mobile_country_code: mobileCountryCode !== null && mobileCountryCode !== void 0 ? mobileCountryCode : null,
                        whatAppcontact: sanitizedWhatsApp !== null && sanitizedWhatsApp !== void 0 ? sanitizedWhatsApp : null,
                    });
                    const patientid = Array.isArray(insertOutcome) ? insertOutcome[0] : insertOutcome;
                    if (!patientid || typeof patientid !== "number") {
                        throw new Error("Failed to create patient");
                    }
                    await (0, appLevelTriggers_1.applyNewPatientAfterInsert)(trx, {
                        patientid,
                        firstname,
                        lastname,
                    });
                    return patientid;
                });
                return createdPatientId;
            }
        }
        catch (error) {
            logger_1.default.error("Error in adding personal information:", error);
            return "An internal server error occurred." /* OperationsFailures.internalServerError */;
        }
    }
    static async emmergencyInformation(tenantId, id, records) {
        const { emmergencyContactName, emmergencyContactNumber, relationship, address, occupation } = records;
        const values = [emmergencyContactName, emmergencyContactNumber, relationship, occupation, address, id];
        return (0, helper_1.rowAffected)(await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_patient_update_emmergency_information, values));
    }
    async getCustomersRecords(tenantId, data) {
        const { count = 10, mobile, page = 1, fullname, email, patientid, from, to, sortby = 'DESC' } = data;
        var query = queries_1.q_filter_patients;
        if (patientid) {
            const is_valid_ptid = await Registration.checkPatientIdExist(tenantId, patientid);
            if (is_valid_ptid) {
                return await this.getPatientBasicData(tenantId, patientid);
            }
        }
        const values = [];
        let conditions = [];
        const mob_str = `${mobile}`;
        var isMobright = mobile && mob_str.length == 10 && mob_str.charAt(0) == "0" && !isNaN(mobile);
        var mobileNum;
        if (mobile && !isMobright && mob_str.length == 9 && mob_str.charAt(0) != "0") {
            mobileNum = mob_str.padStart(10, "0");
            conditions.push(`np.mobile_number = ?`);
            values.push(mobileNum);
        }
        if (fullname && fullname.length > 2) {
            conditions.push(`CONCAT(np.firstname, ' ', COALESCE(np.middlename, ''), ' ', np.lastname) LIKE ?`);
            values.push(`%${fullname}%`);
        }
        if (email && email.includes("@")) {
            conditions.push(` np.email = ?`);
            values.push(email);
        }
        if (from) {
            conditions.push(`np.date >= ?`);
            values.push(from);
        }
        if (to) {
            conditions.push(`np.date <= ?`);
            values.push(to);
        }
        if (conditions.length > 0) {
            query += ` WHERE ` + conditions.join(" AND ");
        }
        const offset = (page - 1) * count;
        values.push(parseInt(count.toString()));
        values.push(offset);
        query += sortby ? ` ORDER BY np.patientid ${sortby} LIMIT ? OFFSET ? ` : ` ORDER BY np.patientid DESC LIMIT ? OFFSET ? `;
        try {
            let result = await (0, helper_1.promisifyQuery)(tenantId, query, values);
            return result;
        }
        catch (err) {
            return [];
        }
    }
    addressingInformation(tenantId, paientid, records) {
        throw new Error("Method not implemented.");
    }
    static async UpdatePersonalInformation(tenantId, clientdata, patientid) {
        const isPatientId = await this.checkPatientIdExist(tenantId, patientid);
        if (!isPatientId)
            return "Resource not found." /* OperationsFailures.notFound */;
        const previousData = await this.getPatientDataUsingPatientId(tenantId, patientid);
        const { designation, firstname, lastname, middlename, age, ageType, gender, email, mobile, mobileownership = "self", days, months, maritalstatus, occupation, patientOrganization, years, whatAppcontact, employeeid } = clientdata;
        const parsedYear = !isNaN(years) ? parseInt(years.toString()) : 0;
        const parsedMonth = !isNaN(months) ? parseInt(months.toString()) : 0;
        const parsedDay = !isNaN(days) ? parseInt(days.toString()) : 0;
        const isCorrectDOB = (parsedYear > 0 && parsedMonth > 0 && parsedDay > 0);
        const dob = isCorrectDOB ? `${parsedYear}-${parsedMonth}-${parsedDay}` : null;
        const persistedMobileNumber = mobileownership === 'relative' ? null : Registration.normalizePhoneTo10(mobile);
        const persistedWhatsappNumber = Registration.normalizePhoneTo10(whatAppcontact);
        const values = [
            firstname,
            designation,
            lastname,
            middlename,
            email,
            age,
            ageType,
            dob,
            maritalstatus,
            persistedMobileNumber,
            occupation,
            gender,
            patientOrganization,
            persistedWhatsappNumber,
            patientid,
        ];
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_patient_update_personal_information, values);
        const updated = (0, helper_1.rowAffected)(result);
        if (updated) {
            const newData = await this.getPatientDataUsingPatientId(tenantId, patientid);
            await this.createPatientAuditLog(tenantId, {
                patientid,
                section: 'personal_information',
                actionType: 'UPDATE',
                changedByEmployeeId: employeeid ? parseInt(employeeid.toString(), 10) : null,
                previousData,
                newData
            });
        }
        return updated;
    }
    async getPatientInfoUsingBillingId(tenantId, billingid) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_filter_patient_using_billingid_query, [billingid]);
        return result;
    }
    static async isBulkRegistration(tenantId) {
        try {
            const query = `SELECT bulkregistration FROM applicationsettings`;
            const result = await (0, helper_1.promisifyQuery)(tenantId, query);
            if (result.length === 0)
                return false;
            const { bulkregistration } = result[0];
            return bulkregistration === 1;
        }
        catch (err) {
            throw new Error(err);
        }
    }
    static async addressingInformationStatic(tenantId, id, records) {
        try {
            const { area, region, gpsLocation, address, country, districtCode } = records;
            const values = [area, country, districtCode, region, gpsLocation, address, id];
            const result = (0, helper_1.rowAffected)(await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_patient_update_patient_addressing, values));
            return result;
        }
        catch (err) {
            throw new Error((err === null || err === void 0 ? void 0 : err.message) || err);
        }
    }
    static async isClientSame(tenantId, clientdata) {
        try {
            if (!clientdata || (typeof clientdata !== 'object')) {
                logger_1.default.error('isClientSame: Invalid clientdata');
                return false;
            }
            const { mobile, mobileownership, email } = clientdata;
            const verifyOwnerShip = (result) => {
                if (result && result.length > 0) {
                    return mobileownership !== 'relative';
                }
                return false;
            };
            if (mobile) {
                let mobileStr = undefined;
                if (typeof mobile === 'string') {
                    mobileStr = String(mobile).trim();
                }
                else if (typeof mobile === 'number' && !isNaN(mobile)) {
                    mobileStr = mobile.toString();
                }
                if (mobileStr && mobileStr.length > 0 && /^\d{9,15}$/.test(mobileStr)) {
                    const result = await (0, helper_1.promisifyQuery)(tenantId, `SELECT mobile_number AS mobile FROM new_patients WHERE mobile_number = ? AND contactpointer = 'self'`, [mobileStr]);
                    return verifyOwnerShip(result);
                }
            }
            if (email && typeof email === 'string' && email.trim().length > 0 && email.includes("@")) {
                const result = await (0, helper_1.promisifyQuery)(tenantId, `SELECT email FROM new_patients WHERE email = ?`, [email.trim()]);
                return verifyOwnerShip(result);
            }
            return false;
        }
        catch (err) {
            logger_1.default.error('isClientSame error:', err);
            return false;
        }
    }
    static async addNewPatient(tenantId, request, response) {
        const { data } = request.body;
        const employeeId = request.query.employeeid ? parseInt(request.query.employeeid.toString(), 10) : null;
        if (!employeeId) {
            return response.status(400).send({
                status: "error",
                message: "employeeid is required to add a new patient",
            });
        }
        try {
            const missingField = this.getMissingRequiredPatientField(data || {});
            if (missingField) {
                return response.status(400).send({
                    status: "error",
                    message: `${missingField} is required`,
                });
            }
            const isAlreadyRegistered = await this.isClientSame(tenantId, data);
            if (isAlreadyRegistered) {
                response.status(404).send({
                    status: "warning",
                    message: (data === null || data === void 0 ? void 0 : data.mobileownership) === "relative"
                        ? "Number or email is associated with a patient. Please search and bill client to continue."
                        : "Number or email is associated with a different patient. Select 'relative' if the person is a relative.",
                });
                return;
            }
            const insertId = await this.addPersonalInformation(tenantId, Object.assign(Object.assign({}, data), { employeeid: employeeId }));
            if (typeof insertId === "string") {
                return response.status(400).send({
                    status: "error",
                    message: insertId,
                });
            }
            if (insertId) {
                response.status(200).send({
                    status: "success",
                    message: "New patient added successfully",
                    patientid: insertId,
                });
                new PrimeEventsDataSource_1.PrimeEventsSMSDataSource(tenantId).patientRegistrationEvent(tenantId, parseInt(insertId.toString()), employeeId);
            }
            else {
                response.status(400).send({
                    status: "error",
                    message: "Failed to add new patient. Please try again.",
                });
            }
        }
        catch (error) {
            response.status(500).send({
                status: "error",
                message: "An error occurred while trying to add a new patient",
                error: error.message || error,
            });
        }
    }
    static async AdvancedPatientFilter(tenantid, requestbody) {
        try {
            const filters = requestbody;
            if (!filters || Object.keys(filters).length === 0)
                throw new Error("No filter criteria provided");
            const fieldMapping = {
                "patientid": "patientid",
                "firstname": "firstname",
                "lastname": "lastname",
                "middlename": "middlename",
                "fullpatientid": "fullpatientid",
                "email": "email",
                "mobile_number": "mobile_number",
                "gender": "gender",
                "maritalstatus": "marital_status",
                "patientOrganization": "organization",
                "occupation": "occupation"
            };
            const db = await (0, KnexConnections_1.default)(tenantid);
            let query = db("new_patients")
                .leftJoin("roles as rr", "new_patients.registeredby", "rr.employeeid")
                .select("new_patients.patientid", "new_patients.fullpatientid", "new_patients.firstname", "new_patients.lastname", "new_patients.middlename", "new_patients.gender", "new_patients.age", "new_patients.mobile_number as contact", "new_patients.mobile_number", "new_patients.ageType", "new_patients.email", "new_patients.organization", "new_patients.registeredby", "rr.username as registeredbyusername", "new_patients.date", db.raw("CONCAT(new_patients.firstname, ' ', COALESCE(new_patients.middlename, ''), ' ', new_patients.lastname) as fullname"));
            for (const field in filters) {
                const dbColumn = fieldMapping[field];
                if (!dbColumn)
                    continue;
                const value = filters[field];
                if (value === null || value === undefined || value === "")
                    continue;
                if (dbColumn === "gender" || dbColumn === "marital_status") {
                    query = query.andWhere(`new_patients.${dbColumn}`, value.toLowerCase());
                }
                else if (dbColumn === "mobile_number") {
                    let mobileStr = String(value).trim();
                    let normalizedWith0;
                    let normalizedWithout0;
                    if (mobileStr.length === 10 && mobileStr.charAt(0) === "0") {
                        normalizedWith0 = mobileStr;
                        normalizedWithout0 = mobileStr.substring(1);
                    }
                    else if (mobileStr.length === 9) {
                        normalizedWith0 = mobileStr.padStart(10, "0");
                        normalizedWithout0 = mobileStr;
                    }
                    else {
                        normalizedWith0 = mobileStr;
                        normalizedWithout0 = mobileStr;
                    }
                    query = query.andWhere(q => {
                        q.where(`new_patients.${dbColumn}`, "=", normalizedWith0)
                            .orWhere(`new_patients.${dbColumn}`, "=", normalizedWithout0);
                    });
                }
                else {
                    query = query.andWhere(`new_patients.${dbColumn}`, "=", value);
                }
            }
            const { startDate, endDate } = filters;
            if (startDate) {
                query = query.andWhere(db.raw("DATE(new_patients.date) >= ?", [startDate]));
            }
            if (endDate) {
                query = query.andWhere(db.raw("DATE(new_patients.date) <= ?", [endDate]));
            }
            const patients = await query
                .orderBy("patientid", "desc")
                .limit(30);
            return patients;
        }
        catch (error) {
            throw error;
        }
    }
}
exports.default = Registration;
