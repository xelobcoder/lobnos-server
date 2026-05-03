"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestHL7Client = void 0;
const net_1 = __importDefault(require("net"));
const logger_1 = __importDefault(require("../../hooks/logger"));
class TestHL7Client {
    constructor(host = "localhost", port = 6662) {
        this.host = host;
        this.port = port;
        this.client = new net_1.default.Socket();
    }
    connect() {
        console.log("=================================");
        console.log(`Attempting to connect to HL7 server at ${this.host}:${this.port}`);
        console.log("=================================");
        this.client.connect(this.port, this.host, () => {
            console.log("=================================");
            console.log(`Successfully connected to HL7 server on port ${this.port}`);
            console.log("Starting to send test messages...");
            console.log("=================================");
            this.sendTestMessages();
        });
        this.client.on("data", (data) => {
            console.log("=================================");
            console.log("Received server response:");
            console.log(data.toString());
            console.log("=================================");
            logger_1.default.info("Received response:", data.toString());
        });
        let reconnectAttempts = 0;
        const maxReconnectAttempts = 5;
        this.client.on("error", (error) => {
            logger_1.default.error(`Test Client error (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts}):`, error);
            if (reconnectAttempts < maxReconnectAttempts) {
                reconnectAttempts++;
                setTimeout(() => {
                    logger_1.default.info(`Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts})...`);
                    this.connect();
                }, 5000);
            }
            else {
                logger_1.default.error("Max reconnection attempts reached. Stopping reconnection.");
            }
        });
        this.client.on("data", (data) => {
            logger_1.default.info("Received response:", data.toString());
        });
        this.client.on("error", (error) => {
            logger_1.default.error("Test Client error:", error);
            setTimeout(() => {
                logger_1.default.info("Attempting to reconnect...");
                this.connect();
            }, 5000);
        });
        this.client.on("close", () => {
            logger_1.default.info("Connection closed");
        });
    }
    sendTestMessages() {
        const testMessages = [this.createORUMessage(), this.createADTMessage()];
        let messageIndex = 0;
        const sendInterval = setInterval(() => {
            if (messageIndex >= testMessages.length) {
                messageIndex = 0;
            }
            const message = testMessages[messageIndex] + "\r\n";
            const binaryData = Buffer.from(message);
            this.client.write(binaryData.toString("utf8"));
            console.log("=================================");
            console.log(`Sent binary message (${binaryData.length} bytes)`);
            messageIndex++;
        }, 20000);
        this.client.on("close", () => {
            clearInterval(sendInterval);
            logger_1.default.info("Connection closed");
        });
    }
    createORUMessage() {
        return [
            'MSH|^~\\&|Mindray|Analyzer123|LIS|Lab123|20250327110531||ORU^R01|MSG00001|P|2.3.1||||||UNICODE',
            'PID|1||123456^^^^MR||Doe^John^A^Mr.||19800101|M|||123 Main St.^^Accra^^12345^GHA||(233)123456789||(233)987654321||S||123-45-6789|||GHA',
            'PV1|1|I|ICU^1^Bed1^WardA^^^Accra Hospital||||12345^Smith^Jane^B^Dr.^^MD|||||||||||123456^InsuranceA|||||||||||||||||||||||||20250327100000',
            'ORC|RE|ORD00001|FBC12345|LIS12345|CM||||20250327100000|12345^Smith^Jane^B^Dr.^^MD|||12345^Smith^Jane^B^Dr.^^MD',
            'OBR|1|ORD00001|FBC12345|00001^Automated Count^99MRC||20250327100000|||||S1||||20250327101020|||12345^Smith^Jane^B^Dr.^^MD||||||||HM|||||FBC',
            'OBX|1|NM|6690-2^WBC^LN||6.5|10^9/L|4.0-10.0|L|||F|||20250327101020',
            'OBX|2|NM|718-7^HGB^LN||13.5|g/dL|13.0-17.0|N|||F|||20250327101020',
            'OBX|3|NM|4544-3^PLT^LN||250|10^9/L|150-400|N|||F|||20250327101020',
            'OBX|4|NM|789-8^RBC^LN||4.7|10^12/L|4.2-5.9|N|||F|||20250327101020',
            'OBX|5|NM|785-6^MCV^LN||90|fL|80-100|N|||F|||20250327101020',
            'OBX|6|NM|786-4^MCH^LN||30|pg|27-33|N|||F|||20250327101020',
            'OBX|7|NM|787-2^MCHC^LN||33|g/dL|32-36|N|||F|||20250327101020',
            'OBX|8|NM|788-0^RDW^LN||12|%|11-15|N|||F|||20250327101020',
            'OBX|9|NM|777-3^NEUT%^LN||55|%|40-60|N|||F|||20250327101020',
            'OBX|10|NM|778-1^LYMPH%^LN||35|%|20-40|N|||F|||20250327101020',
            'OBX|11|NM|779-9^MONO%^LN||6|%|2-8|N|||F|||20250327101020',
            'OBX|12|NM|780-7^EO%^LN||3|%|1-4|N|||F|||20250327101020',
            'OBX|13|NM|781-5^BASO%^LN||1|%|0-1|N|||F|||20250327101020',
            'OBX|14|NM|770-8^NEUT#^LN||3.6|10^9/L|2.0-7.0|N|||F|||20250327101020',
            'OBX|15|NM|771-6^LYMPH#^LN||2.3|10^9/L|1.0-3.0|N|||F|||20250327101020',
            'OBX|16|NM|772-4^MONO#^LN||0.4|10^9/L|0.2-0.8|N|||F|||20250327101020',
            'OBX|17|NM|773-2^EO#^LN||0.2|10^9/L|0.02-0.5|N|||F|||20250327101020',
            'OBX|18|NM|774-0^BASO#^LN||0.05|10^9/L|0.0-0.2|N|||F|||20250327101020',
            'OBX|19|NM|775-7^RDW-CV^LN||12.5|%|10.0-15.0|N|||F|||20250327101020'
        ].join('\r');
    }
    createADTMessage() {
        return [
            'MSH|^~\\&|Mindray|Analyzer123|LIS|Lab123|20250327110531||ORU^R01|MSG00001|P|2.3.1||||||UNICODE',
            'PID|1||123456^^^^MR||Doe^John^A^Mr.||19800101|M|||123 Main St.^^Accra^^12345^GHA||(233)123456789||(233)987654321||S||123-45-6789|||GHA',
            'PV1|1|I|ICU^1^Bed1^WardA^^^Accra Hospital||||12345^Smith^Jane^B^Dr.^^MD|||||||||||123456^InsuranceA|||||||||||||||||||||||||20250327100000',
            'ORC|RE|ORD00001|FBC12345|LIS12345|CM||||20250327100000|12345^Smith^Jane^B^Dr.^^MD|||12345^Smith^Jane^B^Dr.^^MD',
            'OBR|1|ORD00001|FBC12345|00001^Automated Count^99MRC||20250327100000|||||S1||||20250327101020|||12345^Smith^Jane^B^Dr.^^MD||||||||HM|||||FBC',
            'OBX|1|NM|6690-2^WBC^LN||6.5|10^9/L|4.0-10.0|L|||F|||20250327101020',
            'OBX|2|NM|718-7^HGB^LN||13.5|g/dL|13.0-17.0|N|||F|||20250327101020',
            'OBX|3|NM|4544-3^PLT^LN||250|10^9/L|150-400|N|||F|||20250327101020',
            'OBX|4|NM|789-8^RBC^LN||4.7|10^12/L|4.2-5.9|N|||F|||20250327101020',
            'OBX|5|NM|785-6^MCV^LN||90|fL|80-100|N|||F|||20250327101020',
            'OBX|6|NM|786-4^MCH^LN||30|pg|27-33|N|||F|||20250327101020',
            'OBX|7|NM|787-2^MCHC^LN||33|g/dL|32-36|N|||F|||20250327101020',
            'OBX|8|NM|788-0^RDW^LN||12|%|11-15|N|||F|||20250327101020',
            'OBX|9|NM|777-3^NEUT%^LN||55|%|40-60|N|||F|||20250327101020',
            'OBX|10|NM|778-1^LYMPH%^LN||35|%|20-40|N|||F|||20250327101020',
            'OBX|11|NM|779-9^MONO%^LN||6|%|2-8|N|||F|||20250327101020',
            'OBX|12|NM|780-7^EO%^LN||3|%|1-4|N|||F|||20250327101020',
            'OBX|13|NM|781-5^BASO%^LN||1|%|0-1|N|||F|||20250327101020',
            'OBX|14|NM|770-8^NEUT#^LN||3.6|10^9/L|2.0-7.0|N|||F|||20250327101020',
            'OBX|15|NM|771-6^LYMPH#^LN||2.3|10^9/L|1.0-3.0|N|||F|||20250327101020',
            'OBX|16|NM|772-4^MONO#^LN||0.4|10^9/L|0.2-0.8|N|||F|||20250327101020',
            'OBX|17|NM|773-2^EO#^LN||0.2|10^9/L|0.02-0.5|N|||F|||20250327101020',
            'OBX|18|NM|774-0^BASO#^LN||0.05|10^9/L|0.0-0.2|N|||F|||20250327101020',
            'OBX|19|NM|775-7^RDW-CV^LN||12.5|%|10.0-15.0|N|||F|||20250327101020'
        ].join("\r");
    }
}
exports.TestHL7Client = TestHL7Client;
