import { AccountingError } from '../errors/AccountingErrors';
export type Recurrence = { start_date: string | Date; frequency: string; interval_count: number; end_date?: string | Date | null };
export function dateOnly(value: unknown): string {
 const raw=String(value || '');
 const text = value instanceof Date ? value.toISOString().slice(0,10) : /^\d{4}-\d{2}-\d{2}[T ]/.test(raw) ? raw.slice(0,10) : raw;
 if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(new Date(text+'T00:00:00Z').getTime()) || new Date(text+'T00:00:00Z').toISOString().slice(0,10)!==text) throw new AccountingError('Use a valid date in YYYY-MM-DD format','INVALID_DATE',400);
 return text;
}
export function addDays(date: string, days: number): string { const value=new Date(dateOnly(date)+'T00:00:00Z');value.setUTCDate(value.getUTCDate()+days);return value.toISOString().slice(0,10); }
/** Always calculate from the original anchor, so Jan 31 -> Feb 28 -> Mar 31. */
export function occurrenceDate(profile: Recurrence, index: number): string {
 const start=dateOnly(profile.start_date),value=new Date(start+'T00:00:00Z'), interval=Number(profile.interval_count);
 if(!Number.isInteger(index)||index<0||!Number.isInteger(interval)||interval<1||interval>365||!['daily','weekly','monthly','yearly'].includes(profile.frequency))throw new AccountingError('Invalid recurrence interval','INVALID_RECURRENCE',400);
 if(profile.frequency==='daily'||profile.frequency==='weekly')return addDays(start,index*interval*(profile.frequency==='weekly'?7:1));
 const month=value.getUTCMonth()+index*interval*(profile.frequency==='yearly'?12:1),target=new Date(Date.UTC(value.getUTCFullYear(),month,1));
 const last=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();target.setUTCDate(Math.min(value.getUTCDate(),last));return target.toISOString().slice(0,10);
}
export function occurrences(profile: Recurrence, from: string, to: string): string[] {
 const result:string[]=[],start=dateOnly(profile.start_date),end=profile.end_date?dateOnly(profile.end_date):to;
 // Bound iteration; schedules older than this require a new start date rather than silent truncation.
 for(let index=0;index<=10000;index++){const date=occurrenceDate(profile,index);if(date>to||date>end)return result;if(date>=from)result.push(date);if(index===10000)throw new AccountingError(`The schedule starting ${start} is too old; review its start date`,'RECURRENCE_LIMIT',400);}
 return result;
}
