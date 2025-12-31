"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HL7Parser = void 0;
class HL7Parser {
    constructor() {
        this.MSH_SEGMENT = 'MSH';
        this.SEGMENT_SEPARATOR = '\r';
        this.FIELD_SEPARATOR = '|';
    }
    parse(message) {
        const segments = message.split(this.SEGMENT_SEPARATOR);
        const header = this.parseHeader(segments[0]);
        return {
            type: this.getMessageType(header),
            header,
            segments: segments.slice(1).map(this.parseSegment.bind(this))
        };
    }
    createACK(originalMessage) {
        // Create acknowledgment
        return `MSH|^~\\&|LIS|LAB|${originalMessage.header.sendingApp}|${originalMessage.header.sendingFacility}|${this.getDateTime()}||ACK|${this.generateMessageId()}|P|2.5.1\rMSA|AA|${originalMessage.header.messageId}`;
    }
    createNAK() {
        // Create negative acknowledgment
        return `MSH|^~\\&|LIS|LAB|ERROR|ERROR|${this.getDateTime()}||ACK|${this.generateMessageId()}|P|2.5.1\rMSA|AE|000`;
    }
    parseHeader(header) {
        const fields = header.split(this.FIELD_SEPARATOR);
        return {
            sendingApp: fields[2],
            sendingFacility: fields[3],
            messageType: fields[8],
            messageId: fields[9],
            timestamp: fields[6]
        };
    }
    parseSegment(segment) {
        return segment.split(this.FIELD_SEPARATOR);
    }
    getMessageType(header) {
        return header.messageType.split('^')[0];
    }
    getDateTime() {
        return new Date().toISOString().replace(/[:-]/g, '');
    }
    generateMessageId() {
        return `MSG${Date.now()}`;
    }
}
exports.HL7Parser = HL7Parser;
