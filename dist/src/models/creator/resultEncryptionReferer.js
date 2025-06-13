"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
async function resultEncrptionReferer(resources, mode = "encryption") {
    try {
        let refinedResources = resources.map((item, index) => {
            const { id, originalvalue, fieldid, field, value } = item;
            if (!fieldid || !originalvalue || !value)
                return null;
            return {
                field,
                value,
                id: id ? id : index + 1,
                originalvalue,
                fieldid
            };
        });
        refinedResources = refinedResources.filter(item => item !== null);
        if (refinedResources.length === 0)
            return { resources: [] };
        const response = await fetch(mode === "encryption" ?
            process.env.ENCRYPTION_CHANNEL_ENDPOINT :
            process.env.DECRYPTION_CHANNEL_ENDPOINT, {
            method: 'POST',
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({ resources: refinedResources })
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json().catch(err => {
            console.error('Error parsing JSON:', err);
            throw new Error('Invalid JSON response');
        });
        return result;
    }
    catch (err) {
        console.log('Validation or fetch error:', err);
    }
}
exports.default = resultEncrptionReferer;
