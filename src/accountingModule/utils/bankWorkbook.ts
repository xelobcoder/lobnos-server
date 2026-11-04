import { minorUnits } from './money';

export type BankDateFormat = 'YMD' | 'DMY' | 'MDY';

/** ISO text is unambiguous. Other text requires an explicit, workbook-wide format. */
export function bankWorkbookDate(value: unknown, format?: BankDateFormat, date1904 = false): string | null {
     if (value instanceof Date) return Number.isFinite(value.getTime()) && value.getUTCFullYear() >= 1900 && value.getUTCFullYear() <= 9999 ? value.toISOString().slice(0, 10) : null;
     if (typeof value === 'number') {
          if (!Number.isFinite(value) || value < 0 || (!date1904 && Math.floor(value) === 60)) return null;
          const date = new Date((Math.floor(value) - (date1904 ? 24107 : value < 60 ? 25568 : 25569)) * 86400000);
          return Number.isFinite(date.getTime()) && date.getUTCFullYear() >= 1900 && date.getUTCFullYear() <= 9999 ? date.toISOString().slice(0, 10) : null;
     }
     if (typeof value !== 'string') return null;
     const text = value.trim();
     const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
     let year: number, month: number, day: number;
     if (iso) [, year, month, day] = iso.map(Number);
     else {
          if (!format) return null;
          const match = (format === 'YMD' ? /^(\d{4})([/-])(\d{1,2})\2(\d{1,2})$/ : /^(\d{1,2})([/-])(\d{1,2})\2(\d{4})$/).exec(text);
          if (!match) return null;
          const first = Number(match[1]), second = Number(match[3]), third = Number(match[4]);
          [year, month, day] = format === 'YMD' ? [first, second, third] : format === 'DMY' ? [third, second, first] : [third, first, second];
     }
     if (year < 1900 || year > 9999) return null;
     const date = new Date(Date.UTC(year, month - 1, day));
     return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
          ? date.toISOString().slice(0, 10) : null;
}

/** Bank statement convention: DR / parentheses = outflow, CR = inflow. No character stripping. */
export function bankWorkbookAmount(value: unknown, blankIsZero = false): number | null {
     if (value == null || value === '') return blankIsZero ? 0 : null;
     if (typeof value === 'number') {
          try { return minorUnits(value) / 100; } catch { return null; }
     }
     if (typeof value !== 'number' && typeof value !== 'string') return null;
     let text = String(value).trim();
     if (!text) return blankIsZero ? 0 : null;
     let sign = 1;
     const suffix = /\s*(DR|CR)$/i.exec(text);
     if (suffix) {
          sign = suffix[1].toUpperCase() === 'DR' ? -1 : 1;
          text = text.slice(0, suffix.index).trim();
          if (/^[+-]/.test(text) || /[()]/.test(text)) return null;
     } else if (text.startsWith('(') && text.endsWith(')')) {
          sign = -1;
          text = text.slice(1, -1).trim();
          if (/^[+-]/.test(text)) return null;
     }
     if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text)) return null;
     try { return sign * minorUnits(text.replace(/,/g, '')) / 100; } catch { return null; }
}
