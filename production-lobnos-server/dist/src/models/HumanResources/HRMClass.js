"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class HR {
    constructor(employeeid) {
        this.employeeid = employeeid;
    }
    get newEmployeeid() {
        return this.employeeid;
    }
    set newEmployeeid(employeeid) {
        this.employeeid = employeeid;
    }
}
exports.default = HR;
