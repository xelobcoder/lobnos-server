"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaceholderService = void 0;
class PlaceholderService {
    process(template, data) {
        return template.replace(/{{(\w+)}}/g, (_, key) => { var _a; return (_a = data[key]) !== null && _a !== void 0 ? _a : ''; });
    }
}
exports.PlaceholderService = PlaceholderService;
