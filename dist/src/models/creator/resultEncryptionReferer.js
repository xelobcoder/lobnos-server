"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = resultEncrptionReferer;
const encryptionModels_1 = require("../../utils/encryptionModels");
async function resultEncrptionReferer(resources, mode = "encryption") {
    try {
        let refinedResources = resources.map((item, index) => {
            const { id, originalvalue, fieldid, field, value, entrymode } = item;
            if (!fieldid || !originalvalue || !value)
                return null;
            return {
                field,
                value: value.toString(),
                id: id ? id : index + 1,
                originalvalue,
                fieldid, entrymode
            };
        });
        refinedResources = refinedResources.filter(item => item !== null);
        if (refinedResources.length === 0)
            return { resources: [] };
        // const response = await fetch(mode === "encryption" ?
        //      process.env.ENCRYPTION_CHANNEL_ENDPOINT :
        //      process.env.DECRYPTION_CHANNEL_ENDPOINT, {
        //      method: 'POST',
        //      headers: {
        //           "content-type": "application/json",
        //      },
        //      body: JSON.stringify({ resources: refinedResources })
        // });
        // if (!response.ok) {
        //      throw new Error(`HTTP error! status: ${response.status}`);
        // }
        // const result = await response.json().catch(err => {
        //      console.error('Error parsing JSON:', err);
        //      throw new Error('Invalid JSON response');
        // });
        const result = mode === "encryption" ?
            (0, encryptionModels_1.encrypt_resources)({ resources: refinedResources }) :
            (0, encryptionModels_1.decrypt_resources)({ resources: refinedResources });
        return result;
    }
    catch (_a) {
        return undefined;
    }
}
