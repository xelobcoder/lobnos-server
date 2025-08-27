import crypto from 'crypto';

export const ENCRYPTION_KEY: Buffer = crypto.createHash('sha256').update('TiifuHamza').digest();


export class ResourceItem {
     constructor(
          public id: any,
          public field: string,
          public value: string,
          public fieldid: any,
          public originalvalue?: string,
          public entrymode?: string
     ) { }
}

export class EncryptedResourceItem extends ResourceItem { }

export class ResourceRequest {
     constructor(public resources: ResourceItem[]) { }
}

export class EncryptedResourceResponse {
     constructor(public resources: EncryptedResourceItem[]) { }
}

export function encrypt_value(value: string): string {
     if (!value) return '';
     const iv = crypto.randomBytes(16);
     // @ts-ignore: Buffer is valid as CipherKey in Node.js
     const cipher = crypto.createCipheriv('aes-256-cfb', ENCRYPTION_KEY as any, iv as any);
     const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()] as any);
     return Buffer.concat([iv, encrypted] as any).toString('base64');
}

export function decrypt_value(encrypted_value: string): string {
     if (!encrypted_value) return '';
     const encrypted_data = Buffer.from(encrypted_value, 'base64');
     const iv = encrypted_data.slice(0, 16);
     const encrypted = encrypted_data.slice(16);
     // @ts-ignore: Buffer is valid as CipherKey in Node.js
     const decipher = crypto.createDecipheriv('aes-256-cfb', ENCRYPTION_KEY as any, iv as any);
     const decrypted = Buffer.concat([decipher.update(encrypted as Uint8Array), decipher.final()] as any);
     return decrypted.toString('utf8');
}


export function encrypt_resources(resource_request: ResourceRequest): EncryptedResourceResponse {
     const encrypted_resources: EncryptedResourceItem[] = [];
     for (const item of resource_request.resources) {
          if (!item.value || item.value.length === 0) {
               encrypted_resources.push(item as EncryptedResourceItem);
               continue;
          }
          let encrypted_value: string | undefined, encrypted_original_value: string | undefined;
          if (item.value && item.originalvalue) {
               encrypted_value = encrypt_value(item.value);
               encrypted_original_value = encrypt_value(item.originalvalue);
          }
          encrypted_resources.push(new EncryptedResourceItem(
               item.id,
               item.field,
               encrypted_value!,
               item.fieldid,
               encrypted_original_value,
               item.entrymode
          ));
     }
     return new EncryptedResourceResponse(encrypted_resources);
}


export function decrypt_resources(encrypted_resource_response: EncryptedResourceResponse): ResourceRequest {
     const decrypted_resources: ResourceItem[] = [];
     for (const item of encrypted_resource_response.resources) {
          if (!item.value || item.value.length === 0) {
               decrypted_resources.push(item as ResourceItem);
               continue;
          }
          let decrypted_value: string | undefined, original_decrypted_value: string | undefined;
          if (item.value && item.originalvalue) {
               decrypted_value = decrypt_value(item.value);
               original_decrypted_value = decrypt_value(item.originalvalue);
          }
          decrypted_resources.push(new ResourceItem(
               item.id,
               item.field,
               decrypted_value!,
               item.fieldid,
               original_decrypted_value,
               item.entrymode
          ));
     }
     return new ResourceRequest(decrypted_resources);
}

export function text_reference_formatting(text_reference: string): string[] | string | null {
     if (typeof text_reference !== 'string') return null;
     const has_comma_delimiter = text_reference.includes(',');
     const has_newline_delimiter = text_reference.includes('\n');
     let splitted_references: string[] | null = null;
     if (has_comma_delimiter) {
          splitted_references = text_reference.split(',');
     } else if (has_newline_delimiter) {
          splitted_references = text_reference.split('\n');
     } else {
          splitted_references = [];
     }
     if (Array.isArray(splitted_references) && text_reference.length > 0) {
          return splitted_references.map(item => `${item}<br />`);
     }
     return text_reference;
}
