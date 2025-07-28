"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleReceivedIntefacingData = exports.deleteDeviceHandler = exports.updateDeviceHandler = exports.createDeviceHandler = exports.getDeviceByIdHandler = exports.getAllDevicesHandler = void 0;
const MedicalInterfacingDevicesRepository_1 = __importDefault(require("../../../models/settings/devices/MedicalInterfacingDevicesRepository"));
const ascension_1 = require("../../../models/operations/ascension");
const testpanelList_1 = require("../../../testpanel/testpanelList");
const TestCreationRulesRepository_1 = __importDefault(require("../../../models/TestCreation/TestCreationRulesRepository"));
const TiifuWorkingClass_1 = require("../../../database/TiifuWorkingClass");
const creator_1 = __importDefault(require("../../../models/creator/creator"));
const getRepo = (tenantId) => new MedicalInterfacingDevicesRepository_1.default(tenantId);
async function getAllDevicesHandler(req, res) {
    try {
        const tenantId = Number(req.query.tenantId) || 1;
        const repo = getRepo(tenantId);
        const devices = await repo.getAllDevices();
        res.json(devices);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}
exports.getAllDevicesHandler = getAllDevicesHandler;
async function getDeviceByIdHandler(req, res) {
    try {
        const tenantId = Number(req.query.tenantId) || 1;
        const repo = getRepo(tenantId);
        const device = await repo.getDeviceById(Number(req.params.id));
        if (!device)
            return res.status(404).json({ error: "Device not found" });
        res.json(device);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}
exports.getDeviceByIdHandler = getDeviceByIdHandler;
async function createDeviceHandler(req, res) {
    try {
        const tenantId = Number(req.query.tenantId) || 1;
        const repo = getRepo(tenantId);
        const id = await repo.createDevice(req.body);
        res.status(201).json({ id });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}
exports.createDeviceHandler = createDeviceHandler;
async function updateDeviceHandler(req, res) {
    try {
        const tenantId = Number(req.query.tenantId) || 1;
        const repo = getRepo(tenantId);
        const updated = await repo.updateDevice(Number(req.params.id), req.body);
        res.json({ updated });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}
exports.updateDeviceHandler = updateDeviceHandler;
async function deleteDeviceHandler(req, res) {
    try {
        const tenantId = Number(req.query.tenantId) || 1;
        const repo = getRepo(tenantId);
        const deleted = await repo.deleteDevice(Number(req.params.id));
        res.json({ deleted });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}
exports.deleteDeviceHandler = deleteDeviceHandler;
async function handleReceivedIntefacingData(req, res) {
    try {
        const tenantId = Number(req.query.tenantId) || 3;
        const repo = getRepo(tenantId);
        const { data, device, timestamp } = req.body;
        const ascensionId = data[1]['PATIENT_ID'] || data[1]['PATIENT_ID'].toString();
        const providedTestIdx = device.testid;
        if (!providedTestIdx || !Array.isArray(providedTestIdx) || providedTestIdx.length === 0)
            return res.status(400).json({ error: "Provided test index is required" });
        if (!ascensionId)
            return res.status(400).json({ error: "Ascension ID is required" });
        const ascensionInformation = await ascension_1.TestAscension.findAscension(tenantId, ascensionId);
        if (!ascensionInformation)
            return res.status(404).json({ error: "Ascension information not found" });
        const knownTestId = ascensionInformation.testid;
        if (!providedTestIdx.includes(knownTestId)) {
            return res.status(400).json({ error: "Provided test ID does not match ascension information assciated testid" });
        }
        const getMappingInformatoion = await testpanelList_1.testpanel.getTestInfo(tenantId, knownTestId);
        if (!getMappingInformatoion)
            return res.status(404).json({ error: "Test information not found for the provided test ID" });
        const deviceInterfaceMapping = getMappingInformatoion['deviceInterfaceMapping'] != null ?
            typeof getMappingInformatoion['deviceInterfaceMapping'] === 'string' ?
                JSON.parse(getMappingInformatoion['deviceInterfaceMapping']) :
                getMappingInformatoion['deviceInterfaceMapping']
            : null;
        // Get test creation rules first
        const testCreationRules = await new TestCreationRulesRepository_1.default(tenantId).findByTestId(knownTestId);
        // Extract OBX values for mapped analytes and merge with testCreationRules
        let obxResults = [];
        if (deviceInterfaceMapping && typeof deviceInterfaceMapping === 'object') {
            const obxSegments = data.filter(seg => seg.SEGMENT === 'OBX');
            for (const [deviceCode, analyte] of Object.entries(deviceInterfaceMapping)) {
                const matchingObx = obxSegments.filter(seg => seg.OBSERVATION_SUB_ID === analyte);
                for (const obx of matchingObx) {
                    const fieldidNum = Number(deviceCode);
                    const rule = Array.isArray(testCreationRules) ? testCreationRules.find(r => r.id === fieldidNum) : undefined;
                    obxResults.push({
                        fieldid: fieldidNum,
                        value: obx.OBSERVATION_VALUE,
                        originalvalue: obx.OBSERVATION_VALUE,
                        field: (rule === null || rule === void 0 ? void 0 : rule.name) || '',
                        entrymode: 'automatic'
                    });
                }
            }
        }
        if (obxResults.length === 0)
            return res.status(400).json({ error: "No OBX results found for the provided device mapping" });
        const { billingid } = ascensionInformation;
        const comments = '';
        const csvid = `Qzb6uPyN0T0qRx8UE2NIjsusvUSxD4Hnc5iWR9DGFuBRg7YxeCO3fnSrw59LTptnNNPq3t${billingid}`;
        const drugs = [];
        const employeeid = 3;
        const patientInfo = await new TiifuWorkingClass_1.TiifuWorkingClass('billing').findOne(tenantId, 'billingid', billingid);
        if (!patientInfo)
            return res.status(404).json({ error: "Patient ID not found for the provided billing ID" });
        const patientid = patientInfo.patientid;
        const ptid = `USxD4Hnc5iWR9DGFuBRg7YxeCQzb6uPyN0T0qRx8UE2NIjsusv${patientid.toString()}`;
        const finalData = { testid: knownTestId, ascensionid: ascensionId, isScan: false, csvid, ptid, comments, drugs, employeeid, fields: obxResults, hasDrugs: false };
        const resultEntry = await new creator_1.default(knownTestId).resultEntry(tenantId, finalData);
        return res.status(200).json({
            status: resultEntry ? "success" : "error",
            message: "Data processed successfully",
            ascensionInformation,
            getMappingInformatoion,
            obxResults
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}
exports.handleReceivedIntefacingData = handleReceivedIntefacingData;
