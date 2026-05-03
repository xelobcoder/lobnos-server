"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const securityClass_1 = __importDefault(require("./securityClass"));
const bcrypt_1 = __importDefault(require("bcrypt"));
class SecurityVerify extends securityClass_1.default {
    constructor(employeeid, loginDuration) {
        super(employeeid, loginDuration);
    }
    static async encryptResultStored(result) {
        try {
            const { value } = result;
            if (!value || (typeof value != "string" && typeof value != "number")) {
                throw new Error("value not included in the result set");
            }
            const encrptedValue = await bcrypt_1.default.hash(value, 10);
            console.log(encrptedValue);
        }
        catch (err) {
            console.log(err);
        }
    }
}
exports.default = SecurityVerify;
