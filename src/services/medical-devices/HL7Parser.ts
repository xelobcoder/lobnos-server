export class HL7Parser {
    private readonly MSH_SEGMENT = 'MSH';
    private readonly SEGMENT_SEPARATOR = '\r';
    private readonly FIELD_SEPARATOR = '|';

    parse(message: string) {
        const segments = message.split(this.SEGMENT_SEPARATOR);
        const header = this.parseHeader(segments[0]);

        return {
            type: this.getMessageType(header),
            header,
            segments: segments.slice(1).map(this.parseSegment.bind(this))
        };
    }

    createACK(originalMessage: any) {
        // Create acknowledgment
        return `MSH|^~\\&|LIS|LAB|${originalMessage.header.sendingApp}|${originalMessage.header.sendingFacility}|${this.getDateTime()}||ACK|${this.generateMessageId()}|P|2.5.1\rMSA|AA|${originalMessage.header.messageId}`;
    }

    createNAK() {
        // Create negative acknowledgment
        return `MSH|^~\\&|LIS|LAB|ERROR|ERROR|${this.getDateTime()}||ACK|${this.generateMessageId()}|P|2.5.1\rMSA|AE|000`;
    }

    private parseHeader(header: string) {
        const fields = header.split(this.FIELD_SEPARATOR);
        return {
            sendingApp: fields[2],
            sendingFacility: fields[3],
            messageType: fields[8],
            messageId: fields[9],
            timestamp: fields[6]
        };
    }

    private parseSegment(segment: string) {
        return segment.split(this.FIELD_SEPARATOR);
    }

    private getMessageType(header: any) {
        return header.messageType.split('^')[0];
    }

    private getDateTime() {
        return new Date().toISOString().replace(/[:-]/g, '');
    }

    private generateMessageId() {
        return `MSG${Date.now()}`;
    }
}