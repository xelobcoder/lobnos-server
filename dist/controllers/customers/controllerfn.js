"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCustomers = void 0;
const registration_1 = require("../../models/registration/registration");
async function getCustomers(request, response) {
    try {
        const query = request.query;
        const data = await new registration_1.Registration().getCustomersRecords(query);
        response.send(data);
    }
    catch (err) {
        response.send([]);
    }
}
exports.getCustomers = getCustomers;
