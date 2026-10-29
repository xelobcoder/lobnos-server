import Decimal from 'decimal.js';
export const GHANA_RULE={version:'GH-2026-09-GRA-SSNIT-1',effectiveFrom:'2026-09-01',effectiveTo:'2026-12-31',currency:'GHS',employeeRate:5.5,employerRate:13,tier1Rate:13.5,tier2Rate:5,ssnitCeiling:69000,ssnitMinimumRemittance:79.40,
 sources:['https://gra.gov.gh/domestic-tax/tax-types/paye/','https://www.ssnit.org.gh/faqs/','https://www.ssnit.org.gh/wp-content/uploads/2026/01/Public-Notice-Min-Max-Insurable.pdf','https://www.bcp.gov.gh/acc/registry/docs/BASIC%20NATIONAL%20SOCIAL%20SECURITY%20SCHEME%20REGULATIONS%2C%202011%20%28L.I.%201989%29.pdf'],
 bands:[{min:0,max:588,rate:0},{min:588,max:668,rate:5},{min:668,max:768,rate:10},{min:768,max:3668,rate:17.5},{min:3668,max:19668,rate:25},{min:19668,max:50000,rate:30},{min:50000,max:null,rate:35}]};
export const money=(value:Decimal.Value)=>new Decimal(value).toDecimalPlaces(2,Decimal.ROUND_HALF_UP).toNumber();
const d=(value:any=0)=>new Decimal(value??0);
export function ghanaRuleFor(date:string,rule=GHANA_RULE){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<rule.effectiveFrom||date>rule.effectiveTo)throw new Error('No verified Ghana statutory rule for this payroll date. Supported: September–December 2026.');return rule;}
export function ghanaProgressiveTax(income:number,bands=GHANA_RULE.bands){let tax=d(0);const breakdown:any[]=[];for(const band of bands){const amount=Decimal.max(0,Decimal.min(d(income),band.max===null?d(income):d(band.max)).minus(band.min));if(amount.gt(0)){const value=amount.mul(band.rate).div(100);tax=tax.plus(value);breakdown.push({...band,amount:money(amount),tax:money(value)});}}return{tax:money(tax),breakdown};}
export function calculateGhanaPayroll(input:{date:string;basic:number;regularTaxable:number;bonus:number;overtime:number;gross:number;profile?:any;statutory?:any;priorTaxableBonus?:number;rule?:typeof GHANA_RULE}){
 const rule=ghanaRuleFor(input.date,input.rule),profile=input.profile||{},statutory=input.statutory||{};
 for(const value of [input.basic,input.regularTaxable,input.bonus,input.overtime,input.gross])if(!Number.isFinite(Number(value))||Number(value)<0)throw new Error('Invalid Ghana payroll amount');
 const exempt=!!Number(profile.pension_exempt??(statutory.ssnit_active===undefined?0:!Number(statutory.ssnit_active)));
 if(exempt&&!String(profile.pension_exemption_reason||'').trim())throw new Error('Record the pension exemption reason in Ghana employee settings');
 const taxExempt=!!Number(profile.tax_exempt??statutory.tax_exempt??0);
 if(taxExempt&&!String(profile.tax_exemption_reason||statutory.tax_exempt_reason||'').trim())throw new Error('Record the approved tax exemption reason');
 const employeePension=exempt?0:money(d(input.basic).mul(rule.employeeRate).div(100));
 const ssnit=exempt||!input.basic?0:money(Decimal.min(d(rule.ssnitCeiling).mul(rule.tier1Rate).div(100),Decimal.max(rule.ssnitMinimumRemittance,d(input.basic).mul(rule.tier1Rate).div(100))));
 const topUp=exempt||!input.basic?0:money(Decimal.max(0,d(ssnit).minus(d(input.basic).mul(rule.tier1Rate).div(100))));
 const employerPension=exempt?0:money(d(input.basic).mul(rule.employerRate).div(100).plus(topUp));
 const tier2=money(d(employeePension).plus(employerPension).minus(ssnit));
 const tier3Employee=Number(statutory.tier3_enrolled)?money(d(input.basic).mul(statutory.tier3_employee_rate||0).div(100)):0;
 const tier3Employer=Number(statutory.tier3_enrolled)?money(d(input.basic).mul(statutory.tier3_employer_rate||0).div(100)):0;
 if(d(tier3Employee).plus(tier3Employer).gt(d(input.basic).mul(.165)))throw new Error('Tier 3 contributions exceed the standard 16.5% tax-relieved limit; review this employee before processing');
 const relief=Number(profile.approved_monthly_relief||0);if(relief>0&&!profile.relief_reference)throw new Error('Approved relief requires a reference');
 let regular=d(input.regularTaxable),bonusTax=0,overtimeTax=0,concessionaryBonus=0;
 const nonresident=(profile.residency||'resident')==='nonresident';
 if(nonresident){bonusTax=money(d(input.bonus).mul(.2));overtimeTax=money(d(input.overtime).mul(.2));}
 else{
  if(input.bonus>0){if(!profile.bonus_history_reviewed||Number(profile.annual_basic_for_bonus)<=0)throw new Error('Confirm annual basic salary and opening bonus history in Ghana employee settings before calculating bonus tax');
   const used=d(input.priorTaxableBonus||0).plus(profile.opening_taxable_bonus||0);const available=Decimal.max(0,d(profile.annual_basic_for_bonus).mul(.15).minus(used));concessionaryBonus=money(Decimal.min(input.bonus,available));bonusTax=money(d(concessionaryBonus).mul(.05));regular=regular.plus(d(input.bonus).minus(concessionaryBonus));}
  if(input.overtime>0&&Number(profile.junior_overtime_eligible)){if(Number(profile.annual_qualifying_income)<=0||Number(profile.annual_qualifying_income)>18000)throw new Error('Confirm qualifying annual income for junior-staff overtime treatment');const lower=Decimal.min(input.overtime,d(input.basic).mul(.5));overtimeTax=money(lower.mul(.05).plus(d(input.overtime).minus(lower).mul(.1)));}
  else regular=regular.plus(input.overtime);
 }
 const chargeable=money(Decimal.max(0,regular.minus(employeePension).minus(tier3Employee).minus(nonresident?0:relief)));
 const progressive=ghanaProgressiveTax(chargeable,rule.bands);const paye=taxExempt?0:money(d(nonresident?money(d(chargeable).mul(.25)):progressive.tax).plus(bonusTax).plus(overtimeTax));
 return{ruleVersion:rule.version,ruleEffectiveFrom:rule.effectiveFrom,currency:'GHS',residency:profile.residency||'resident',dependents:Number(profile.dependents_count??statutory.dependents_count??0),employeePension,employerPension,ssnit,tier2,tier3Employee,tier3Employer,employerMinimumTopUp:topUp,chargeable,paye,bonusTax:taxExempt?0:bonusTax,overtimeTax:taxExempt?0:overtimeTax,concessionaryBonus,approvedRelief:nonresident?0:relief,taxBreakdown:nonresident?[]:progressive.breakdown,sources:rule.sources};
}
export function ghanaManagedDeduction(row:any){if(/\b(loan|advance|repayment)\b/i.test([row.deduction_code,row.deduction_type,row.deduction_name].filter(Boolean).join(' ')))return false;return /(^|[^a-z])(paye|income[ _-]*tax|ssnit|tier[ _-]*[123]|pension|nhis)([^a-z]|$)/i.test([row.deduction_code,row.deduction_type,row.deduction_name].filter(Boolean).join(' '));}
