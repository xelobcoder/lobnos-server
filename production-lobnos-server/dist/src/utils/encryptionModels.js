"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.text_reference_formatting = exports.decrypt_resources = exports.encrypt_resources = exports.decrypt_value = exports.encrypt_value = exports.EncryptedResourceResponse = exports.ResourceRequest = exports.EncryptedResourceItem = exports.ResourceItem = exports.ENCRYPTION_KEY = void 0;
const crypto_1 = __importDefault(require("crypto"));
exports.ENCRYPTION_KEY = crypto_1.default.createHash('sha256').update('TiifuHamza').digest();
class ResourceItem {
    constructor(id, field, value, fieldid, originalvalue, entrymode) {
        this.id = id;
        this.field = field;
        this.value = value;
        this.fieldid = fieldid;
        this.originalvalue = originalvalue;
        this.entrymode = entrymode;
    }
}
exports.ResourceItem = ResourceItem;
class EncryptedResourceItem extends ResourceItem {
}
exports.EncryptedResourceItem = EncryptedResourceItem;
class ResourceRequest {
    constructor(resources) {
        this.resources = resources;
    }
}
exports.ResourceRequest = ResourceRequest;
class EncryptedResourceResponse {
    constructor(resources) {
        this.resources = resources;
    }
}
exports.EncryptedResourceResponse = EncryptedResourceResponse;
function encrypt_value(value) {
    if (!value)
        return '';
    const iv = crypto_1.default.randomBytes(16);
    // @ts-ignore: Buffer is valid as CipherKey in Node.js
    const cipher = crypto_1.default.createCipheriv('aes-256-cfb', exports.ENCRYPTION_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, encrypted]).toString('base64');
}
exports.encrypt_value = encrypt_value;
function decrypt_value(encrypted_value) {
    if (!encrypted_value)
        return '';
    const encrypted_data = Buffer.from(encrypted_value, 'base64');
    const iv = encrypted_data.slice(0, 16);
    const encrypted = encrypted_data.slice(16);
    // @ts-ignore: Buffer is valid as CipherKey in Node.js
    const decipher = crypto_1.default.createDecipheriv('aes-256-cfb', exports.ENCRYPTION_KEY, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
}
exports.decrypt_value = decrypt_value;
function encrypt_resources(resource_request) {
    const encrypted_resources = [];
    for (const item of resource_request.resources) {
        if (!item.value || item.value.length === 0) {
            encrypted_resources.push(item);
            continue;
        }
        let encrypted_value, encrypted_original_value;
        if (item.value && item.originalvalue) {
            encrypted_value = encrypt_value(item.value);
            encrypted_original_value = encrypt_value(item.originalvalue);
        }
        encrypted_resources.push(new EncryptedResourceItem(item.id, item.field, encrypted_value, item.fieldid, encrypted_original_value, item.entrymode));
    }
    return new EncryptedResourceResponse(encrypted_resources);
}
exports.encrypt_resources = encrypt_resources;
function decrypt_resources(encrypted_resource_response) {
    const decrypted_resources = [];
    for (const item of encrypted_resource_response.resources) {
        if (!item.value || item.value.length === 0) {
            decrypted_resources.push(item);
            continue;
        }
        let decrypted_value, original_decrypted_value;
        if (item.value && item.originalvalue) {
            decrypted_value = decrypt_value(item.value);
            original_decrypted_value = decrypt_value(item.originalvalue);
        }
        decrypted_resources.push(new ResourceItem(item.id, item.field, decrypted_value, item.fieldid, original_decrypted_value, item.entrymode));
    }
    return new ResourceRequest(decrypted_resources);
}
exports.decrypt_resources = decrypt_resources;
function text_reference_formatting(text_reference) {
    if (typeof text_reference !== 'string')
        return null;
    const has_comma_delimiter = text_reference.includes(',');
    const has_newline_delimiter = text_reference.includes('\n');
    let splitted_references = null;
    if (has_comma_delimiter) {
        splitted_references = text_reference.split(',');
    }
    else if (has_newline_delimiter) {
        splitted_references = text_reference.split('\n');
    }
    else {
        splitted_references = [];
    }
    if (Array.isArray(splitted_references) && text_reference.length > 0) {
        return splitted_references.map(item => `${item}<br />`);
    }
    return text_reference;
}
exports.text_reference_formatting = text_reference_formatting;
