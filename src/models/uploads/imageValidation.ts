type ImageType = { mime: string; extension: string };
const dimensionsAllowed = (width: number, height: number) => width > 0 && height > 0 && width * height <= 40_000_000;

/** Inspect encoded structure instead of trusting the supplied MIME type or extension. */
export function validatedImageType(bytes: Buffer): ImageType | null {
     if (bytes.length >= 45 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
          if (bytes.readUInt32BE(8) !== 13 || bytes.toString('ascii', 12, 16) !== 'IHDR' ||
               !dimensionsAllowed(bytes.readUInt32BE(16), bytes.readUInt32BE(20))) return null;
          let offset = 8, hasData = false;
          while (offset + 12 <= bytes.length) {
               const size = bytes.readUInt32BE(offset);
               const chunk = bytes.toString('ascii', offset + 4, offset + 8);
               if (size > bytes.length - offset - 12) return null;
               if (chunk === 'IDAT' && size > 0) hasData = true;
               offset += size + 12;
               if (chunk === 'IEND') return hasData && size === 0 && offset === bytes.length ? { mime: 'image/png', extension: 'png' } : null;
          }
          return null;
     }
     if (bytes.length >= 14 && ['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6))) {
          if (!dimensionsAllowed(bytes.readUInt16LE(6), bytes.readUInt16LE(8))) return null;
          let offset = 13 + (bytes[10] & 0x80 ? 3 * (1 << ((bytes[10] & 7) + 1)) : 0);
          let image = false;
          const skipBlocks = () => {
               while (offset < bytes.length) {
                    const size = bytes[offset++];
                    if (!size) return true;
                    offset += size;
               }
               return false;
          };
          while (offset < bytes.length) {
               const marker = bytes[offset++];
               if (marker === 0x3b) return image && offset === bytes.length ? { mime: 'image/gif', extension: 'gif' } : null;
               if (marker === 0x21) { offset++; if (!skipBlocks()) return null; }
               else if (marker === 0x2c) {
                    if (offset + 9 > bytes.length || !dimensionsAllowed(bytes.readUInt16LE(offset + 4), bytes.readUInt16LE(offset + 6))) return null;
                    const flags = bytes[offset + 8];
                    offset += 9 + (flags & 0x80 ? 3 * (1 << ((flags & 7) + 1)) : 0);
                    if (offset >= bytes.length || bytes[offset] < 2 || bytes[offset] > 8) return null;
                    offset++;
                    if (!skipBlocks()) return null;
                    image = true;
               } else return null;
          }
          return null;
     }
     if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9) {
          let offset = 2, hasFrame = false;
          while (offset + 4 <= bytes.length) {
               if (bytes[offset++] !== 0xff) return null;
               while (bytes[offset] === 0xff) offset++;
               const marker = bytes[offset++];
               if (offset + 2 > bytes.length) return null;
               const size = bytes.readUInt16BE(offset);
               if (size < 2 || offset + size > bytes.length) return null;
               if ([0xc0, 0xc1, 0xc2].includes(marker)) {
                    if (size < 8 || !dimensionsAllowed(bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3))) return null;
                    hasFrame = true;
               }
               if (marker === 0xda) return hasFrame && offset + size < bytes.length - 2 ? { mime: 'image/jpeg', extension: 'jpg' } : null;
               offset += size;
          }
     }
     return null;
}
