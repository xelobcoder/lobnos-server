"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cluster_1 = __importDefault(require("cluster"));
const os_1 = __importDefault(require("os"));
const configuration = {
    possibleWorkers: os_1.default.cpus().length,
    fork: function () {
        for (let i = 0; i < this.possibleWorkers; i++) {
            cluster_1.default.fork();
        }
    },
    logRequest: async function (request, response, next) {
        next();
        const origin = request.headers.origin;
        console.log(`${new Date()} referer: ${origin} ${request.method} ${request.baseUrl} ${request.url.split("?")[0]}`);
    },
    configurations: {
        hasInventorySubscribed: 0,
        strictBranchCheck: 1,
        multipleBranchesEnabled: 1,
        hasPurchaseManagement: 1,
    },
};
exports.default = configuration;
