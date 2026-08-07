"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrackValuesAlertClass = void 0;
const registration_1 = __importDefault(require("../registration/registration"));
const FieldConstraintsRepository_repo_1 = __importDefault(require("../TestCreation/repositories/FieldConstraintsRepository.repo"));
const creator_1 = __importDefault(require("./creator"));
const loggingCriticalValueAlertRepository_1 = __importDefault(require("./Repo/loggingCriticalValueAlertRepository"));
const resultEncryptionReferer_1 = __importDefault(require("./resultEncryptionReferer"));
class TrackValuesAlertClass extends creator_1.default {
    constructor(tenantid) {
        super(tenantid);
        this.tenantid = tenantid;
    }
    async getCriticalDetailsWithAscension(crkeyId) {
        if (!crkeyId) {
            throw new Error("CrKeyId not Provided");
        }
        const alertRepo = new loggingCriticalValueAlertRepository_1.default(this.tenantid);
        const alert = await alertRepo.findById(crkeyId);
        if (!alert) {
            throw new Error("Alert not found");
        }
        const { testid, billingid } = alert;
        const registration = new registration_1.default();
        const patientInfo = await registration.getPatientInfoUsingBillingId(this.tenantid, billingid);
        if (!Array.isArray(patientInfo) || !patientInfo.length) {
            throw new Error("Patient information not found");
        }
        const patientid = patientInfo[0].patientid;
        const creator = new creator_1.default(testid);
        const [recordValues, constraints] = await Promise.all([
            creator.getPreviousRecords(this.tenantid, testid, billingid, patientid),
            new FieldConstraintsRepository_repo_1.default(this.tenantid).findByTestId(testid)
        ]);
        const decrtyptedRecordedValues = Array.isArray(recordValues) && recordValues.length > 0 ?
            await (0, resultEncryptionReferer_1.default)(recordValues, "decryption") : { resources: [] };
        const recordValuesWithConstraints = Array.isArray(decrtyptedRecordedValues.resources)
            ? decrtyptedRecordedValues.resources
                .map(record => {
                const constraint = constraints.filter(c => parseInt(c.fieldid.toString()) === parseInt(record.fieldid.toString()));
                return constraint ? Object.assign(Object.assign({}, record), { constraints: [constraint], fieid: record.name }) : null;
            })
                .filter(record => record !== null)
            : [];
        return {
            alert,
            patientInfo: patientInfo[0],
            recordValues: recordValuesWithConstraints
        };
    }
}
exports.TrackValuesAlertClass = TrackValuesAlertClass;
