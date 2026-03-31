"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FreeServicesRepo = exports.FreeServicesService = void 0;
var FreeServicesService_1 = require("./FreeServicesService");
Object.defineProperty(exports, "FreeServicesService", { enumerable: true, get: function () { return FreeServicesService_1.FreeServicesService; } });
var FreeServicesRepo_1 = require("./FreeServicesRepo");
Object.defineProperty(exports, "FreeServicesRepo", { enumerable: true, get: function () { return FreeServicesRepo_1.FreeServicesRepo; } });
__exportStar(require("./types"), exports);
