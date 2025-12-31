"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const test_ascension_1 = require("./test-ascension");
const router = express_1.default.Router();
router.get("/api/v1/testascension/tat-data", test_ascension_1.getTatData);
exports.default = router;
