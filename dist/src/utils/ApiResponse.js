"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiResponse = void 0;
class ApiResponse {
    static success(data, message) {
        return Object.assign({ success: true, data }, (message && { message }));
    }
    static error(message, code = 'INTERNAL_ERROR', details) {
        return {
            success: false,
            error: {
                code,
                message,
                details
            }
        };
    }
}
exports.ApiResponse = ApiResponse;
