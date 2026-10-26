import {Knex} from 'knex';
export interface PharmacyHistoryFields {search?:string;statuses?:string[];reversalType?:string;dateFrom?:string;dateTo?:string;paymentMethod?:string;minTotal?:number;maxTotal?:number}
export class PharmacyHistoryFilterError extends Error {}
export function validatePharmacyHistoryFilters(filters:PharmacyHistoryFields){
 for(const field of ['dateFrom','dateTo'] as const){const value=filters[field];if(value&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value))throw new PharmacyHistoryFilterError('Choose valid sales dates');}
 if(filters.dateFrom&&filters.dateTo&&filters.dateFrom>filters.dateTo)throw new PharmacyHistoryFilterError('The start date cannot be after the end date');
 if(filters.statuses?.some(status=>!['completed','refunded','voided','cancelled'].includes(status)))throw new PharmacyHistoryFilterError('Choose a valid sale status');
 if(filters.paymentMethod&&!['cash','mobile_money','card','split','credit'].includes(filters.paymentMethod))throw new PharmacyHistoryFilterError('Choose a valid payment method');
 for(const field of ['minTotal','maxTotal'] as const){const value=filters[field];if(value!==undefined&&(!Number.isFinite(value)||value<0||value>999999999999.99||Math.abs(value*100-Math.round(value*100))>0.001))throw new PharmacyHistoryFilterError('Enter valid non-negative totals with up to two decimal places');}
 if(filters.minTotal!==undefined&&filters.maxTotal!==undefined&&filters.minTotal>filters.maxTotal)throw new PharmacyHistoryFilterError('Minimum total cannot exceed maximum total');
 if((filters.search?.length||0)>255)throw new PharmacyHistoryFilterError('Search must be no longer than 255 characters');
}
export function applyPharmacyHistoryFilters(query:Knex.QueryBuilder,filters:PharmacyHistoryFields){
 validatePharmacyHistoryFilters(filters);
 if(filters.statuses?.length)query.whereIn('status',filters.statuses);
 if(filters.reversalType)query.where('reversal_type',filters.reversalType);
 if(filters.paymentMethod)query.where('payment_method',filters.paymentMethod);
 if(filters.dateFrom)query.where('completed_at','>=',filters.dateFrom+' 00:00:00');
 if(filters.dateTo){const next=new Date(filters.dateTo+'T00:00:00Z');next.setUTCDate(next.getUTCDate()+1);query.where('completed_at','<',next.toISOString().slice(0,10)+' 00:00:00');}
 if(filters.minTotal!==undefined)query.where('total_amount','>=',filters.minTotal);
 if(filters.maxTotal!==undefined)query.where('total_amount','<=',filters.maxTotal);
 if(filters.search?.trim()){const term=`%${filters.search.trim()}%`;query.where(builder=>builder.where('receipt_number','like',term).orWhere('customer_name','like',term));}
 return query;
}
