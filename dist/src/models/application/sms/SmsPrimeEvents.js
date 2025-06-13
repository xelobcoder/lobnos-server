"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const helper_1 = require("../../../hooks/helper");
const queries_1 = require("./queries");
const smsClass_1 = require("./smsClass");
class SMSPrimeEvents extends smsClass_1.PrimeSmsServices {
    constructor(tenantId, eventname, scheduledDate = null, scheduledTime = null) {
        super();
        this;
        this.eventname = eventname;
        this.scheduledDate = scheduledDate;
        this.scheduledTime = scheduledTime;
    }
    async birthdayEvent() {
        const clients = await (0, helper_1.promisifyQuery)(this.tenantId, queries_1.q_sms_birthday_clients);
        console.log(clients);
    }
}
exports.default = SMSPrimeEvents;
// new SMSPrimeEvents("birthday", null, null)
//      .birthdayEvent()
//      .then(
//           (value) => console.log(value))
//      .catch((err) => console.log(err))
