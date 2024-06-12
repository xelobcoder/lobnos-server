"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var helper_1 = require("../../../helper");
var list_1 = require("../../testpanel/list");
var Creator = /** @class */ (function () {
    function Creator(testid) {
        this.testid = testid;
    }
    Creator.prototype.getTestCreationRule = function () {
        return __awaiter(this, void 0, void 0, function () {
            var rule, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.testid)
                            throw new Error("testid is required");
                        return [4 /*yield*/, (0, helper_1.promisifyQuery)("SELECT creationrule FROM customtestcreation WHERE testid = ?", [this.testid])];
                    case 1:
                        rule = _a.sent();
                        if (rule.length > 0 && rule[0].creationrule !== "{}") {
                            result = JSON.parse(rule[0].creationrule);
                            return [2 /*return*/, result];
                        }
                        return [2 /*return*/, []];
                }
            });
        });
    };
    Creator.prototype.getPreviousRecords = function (testname, billingid, patientid) {
        return __awaiter(this, void 0, void 0, function () {
            var tablename, previousRecords;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        tablename = "result".concat(list_1.default.generateTableName(testname));
                        return [4 /*yield*/, (0, helper_1.promisifyQuery)("SELECT * FROM ".concat(tablename, " WHERE billingid = ? AND patientid = ?"), [
                                billingid,
                                patientid,
                            ])];
                    case 1:
                        previousRecords = _a.sent();
                        return [2 /*return*/, previousRecords];
                }
            });
        });
    };
    Creator.prototype.getCustomPreviousRecords = function (testname, billingid, patientid) {
        return __awaiter(this, void 0, void 0, function () {
            var previousRecords_1, result, hasGenderVariation, clientGender_1, packet, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 5, , 6]);
                        return [4 /*yield*/, this.getPreviousRecords(testname, billingid, patientid)];
                    case 1:
                        previousRecords_1 = _a.sent();
                        if (previousRecords_1.length > 0 && previousRecords_1.some(function (item) { return item.field === "ultrasound"; })) {
                            return [2 /*return*/, previousRecords_1[0]];
                        }
                        return [4 /*yield*/, this.getTestCreationRule()];
                    case 2:
                        result = _a.sent();
                        hasGenderVariation = result.length > 0 && result.some(function (item) { return item.hasGenderVariation === true; });
                        clientGender_1 = "";
                        if (!hasGenderVariation) return [3 /*break*/, 4];
                        return [4 /*yield*/, (0, helper_1.promisifyQuery)("SELECT gender,age,agetype FROM new_patients WHERE patientid = ?", [patientid])];
                    case 3:
                        packet = _a.sent();
                        if (packet.length > 0)
                            clientGender_1 = packet[0]["gender"];
                        _a.label = 4;
                    case 4:
                        if (previousRecords_1.length === 0)
                            return [2 /*return*/, result];
                        result = result.map(function (item) {
                            var name = item.name;
                            var matched = previousRecords_1.find(function (u) { return u.field === name; });
                            return matched ? __assign(__assign({}, item), { value: matched.value }) : item;
                        });
                        if (hasGenderVariation && clientGender_1) {
                            result = result.map(function (item) {
                                var obj = __assign({}, item);
                                if (item[clientGender_1]) {
                                    obj.upperlimit = item[clientGender_1].upperlimit;
                                    obj.lowerlimit = item[clientGender_1].lowerlimit;
                                    delete obj.female;
                                    delete obj.male;
                                }
                                return obj;
                            });
                        }
                        return [2 /*return*/, result];
                    case 5:
                        err_1 = _a.sent();
                        (0, helper_1.responseError)(express_1.Response);
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    Creator.prototype.getCustomCommentsRecords = function (billingid, testid) {
        return __awaiter(this, void 0, void 0, function () {
            var comments;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!billingid || !testid) {
                            throw new Error("testid and billingid required");
                        }
                        return [4 /*yield*/, (0, helper_1.promisifyQuery)("SELECT comments FROM result_comments WHERE billingid = ? AND testid = ?", [billingid, testid])];
                    case 1:
                        comments = _a.sent();
                        return [2 /*return*/, comments.length > 0 ? comments[0]["comments"] : ""];
                }
            });
        });
    };
    Creator.prototype.updateTestCreationRule = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var stringdata, query, isUpdated;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.testid || !data)
                            throw new Error("testid and data is required");
                        stringdata = JSON.stringify(data);
                        query = "UPDATE customtestcreation SET creationrule = ? WHERE testid = ?";
                        return [4 /*yield*/, (0, helper_1.promisifyQuery)(query, [stringdata, this.testid])];
                    case 1:
                        isUpdated = _a.sent();
                        return [2 /*return*/, (0, helper_1.rowAffected)(isUpdated)];
                }
            });
        });
    };
    return Creator;
}());
exports.default = Creator;
