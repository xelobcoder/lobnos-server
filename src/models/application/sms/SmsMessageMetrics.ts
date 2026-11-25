const BASIC = new Set(Array.from('@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'));
const EXTENDED = new Set(Array.from('^{}\\[~]|€\f'));
export function smsMessageMetrics(message: string) {
    let units = 0, unicode = false;
    for (const character of message) {
        if (BASIC.has(character)) units++;
        else if (EXTENDED.has(character)) units += 2;
        else { unicode = true; break; }
    }
    if (unicode) units = message.length;
    const single = unicode ? 70 : 160, concatenated = unicode ? 67 : 153;
    return { encoding: unicode ? 'Unicode' : 'GSM-7', units, segments: units === 0 ? 0 : units <= single ? 1 : Math.ceil(units / concatenated) };
}
export function normalizeSmsPhone(input: unknown): string | null {
    let digits = String(input ?? '').replace(/[\s()+-]/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (/^[1-9]\d{10,14}$/.test(digits) && !digits.startsWith('233')) return digits;
    if (/^(220|238)\d{7}$/.test(digits)) return digits; // Gambia and Cabo Verde international numbers have only 10 digits
    if (/^233\d{9}$/.test(digits)) digits = '0' + digits.slice(3);
    if (/^\d{9}$/.test(digits)) digits = '0' + digits;
    return /^0\d{9}$/.test(digits) ? digits : null;
}
export function smsProviderState(status: unknown): string {
    const value = String(status || '').toUpperCase();
    return value === 'DELIVERED' ? 'delivered' : ['SUBMITTED', 'QUEUED'].includes(value) ? 'submitted' :
        ['NOT_DELIVERED', 'EXPIRED', 'PROHIBITED', 'REJECTED', 'UNDELIVERABLE'].includes(value) ? 'failed' : 'unknown';
}
