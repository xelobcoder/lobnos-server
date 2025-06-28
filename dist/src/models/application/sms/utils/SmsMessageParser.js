"use strict";
// SmsMessageParser.ts
// Utility class for parsing and personalizing SMS message templates
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsMessageParser = void 0;
class SmsMessageParser {
    /**
     * Parses a template string and replaces placeholders with values from the data object.
     * Placeholders are in the format {{key}}.
     * @param template The message template string (e.g., "Hello {{name}}!")
     * @param data An object with key-value pairs for replacement (e.g., { name: "John" })
     * @returns The personalized message string
     */
    static parse(template, data) {
        if (!template || typeof template !== 'string')
            return '';
        return template.replace(/{{\s*(\w+)\s*}}/g, (match, key) => {
            return key in data ? String(data[key]) : '';
        });
    }
}
exports.SmsMessageParser = SmsMessageParser;
