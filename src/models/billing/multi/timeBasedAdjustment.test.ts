import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../../database/KnexConnections',()=>({default:vi.fn()}));
import { PrimeBillingEnterprise } from './PrimeBillingEnterprise';
afterEach(()=>vi.useRealTimers());
const settings=(startTime:string,endTime:string)=>({hasNightAdjustment:true,startTime,endTime,nightAdjustmentMode:'percentage',nightAdjustmentValue:10}) as any;
describe('existing time-based billing windows',()=>{
 it.each([[8,false],[9,true],[16,true],[17,false]])('applies 09:00–17:00 at hour %s = %s',(hour,expected)=>{vi.useFakeTimers();vi.setSystemTime(new Date(2026,9,26,hour,0,0));expect(PrimeBillingEnterprise.isNightTime(settings('09:00','17:00'))).toBe(expected)});
 it.each([[12,false],[13,true],[23,true],[0,true],[7,true],[8,false]])('supports a non-evening period crossing midnight at hour %s = %s',(hour,expected)=>{vi.useFakeTimers();vi.setSystemTime(new Date(2026,9,26,hour,0,0));expect(PrimeBillingEnterprise.isNightTime(settings('13:00','08:00'))).toBe(expected)});
 it('keeps percentage calculations and disabled behavior unchanged',()=>{vi.useFakeTimers();vi.setSystemTime(new Date(2026,9,26,10,0,0));const rows=[{discountedValue:100}];expect(PrimeBillingEnterprise.applyNightAdjustmentsToTests(rows,settings('09:00','17:00'),'test')[0].discountedValue).toBe(110);expect(PrimeBillingEnterprise.applyNightAdjustmentsToTests(rows,{...settings('09:00','17:00'),hasNightAdjustment:false},'test')).toEqual(rows)});
});
