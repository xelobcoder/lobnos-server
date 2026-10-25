import { z } from 'zod';
import { AuthUser } from '../../middleware/authority';
import { CustomerBillingInit } from './multi/initCustomerBilling';
import { CustomerBillingCheckout } from './multi/customerBillingCheckout';
import Outsourcing from '../organization/outsourcingOrganization/outsourcing';

const id = z.number().int().positive();
const optionalId = id.nullish();
const itemSchema = z.object({
    kind: z.enum(['test', 'service']), id,
    adjustment: z.object({ type: z.enum(['discount', 'surcharge']), value: z.number().finite().nonnegative() }).optional(),
    prioritised: z.boolean().optional(), outsourceId: optionalId,
});
export const modernPreviewSchema = z.object({
    context: z.object({
        patientId: z.number().int().nonnegative(), billingId: optionalId,
        billingSource: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(6)]),
        entityId: optionalId, quote: z.boolean().default(false), packageId: optionalId,
        referralCode: z.string().max(150).optional(), promoCode: z.string().max(150).optional(),
        nhisMembershipId: optionalId, claimCheckCode: optionalId,
    }),
    items: z.array(itemSchema).max(500),
});
export type ModernPreviewInput = z.infer<typeof modernPreviewSchema>;
type Dependencies = {
    initialize: (tenantId: number, params: any) => Promise<any>;
    price: (params: any) => Promise<any>;
    organizations: (tenantId: number, testId: number) => Promise<any[]>;
};
const dependencies: Dependencies = {
    async initialize(tenantId, params) {
        if (params.referalCode) {
            const referral = await CustomerBillingCheckout.getInstance(tenantId).getReferralByCode(params.referalCode);
            if (!referral) throw new Error('Invalid referral code');
            params = { ...params, entityId: referral.entity_id, entityType: referral.entity_type };
        }
        return CustomerBillingInit.getInstance(tenantId).init(params);
    },
    price: params => CustomerBillingCheckout.checkoutCustomerBilling(params),
    organizations: async (tenantId, testId) => new Outsourcing('', 0).getTestOutSourcingOrganizations(tenantId, testId),
};

/** Read-only adapter. IDs/options enter here; existing catalogue and pricing rules remain authoritative. */
export class ModernBillingPreview {
    constructor(private readonly services: Dependencies = dependencies) {}

    async review(actor: AuthUser, body: unknown) {
        if (!actor.branch) throw new Error('An assigned branch is required');
        const input = modernPreviewSchema.parse(body);
        const c = input.context;
        if (!c.quote && !c.patientId) throw new Error('Select a patient before reviewing the bill');
        if (![1, 4].includes(c.billingSource) && !c.entityId && !c.referralCode) throw new Error('Select a payer');
        if (c.billingSource === 4 && (!c.nhisMembershipId || !c.claimCheckCode)) throw new Error('NHIS membership and claim check codes are required');
        const keys = input.items.map(item => `${item.kind}:${item.id}`);
        if (new Set(keys).size !== keys.length) throw new Error('Duplicate selections are not allowed');
        if (!input.items.length && !c.packageId) throw new Error('Select at least one test or service');
        const entityType = ({ 1: 'general', 2: 'organization', 3: 'insurance', 4: 'nhis', 6: 'clinician' } as const)[c.billingSource];
        const catalog = await this.services.initialize(actor.tenantId, {
            patientId: c.patientId, billingid: c.billingId || undefined, branchid: actor.branch,
            billingSource: c.billingSource, entityId: c.entityId || undefined, entityType,
            isPackageUsed: Boolean(c.packageId), packageid: c.packageId || undefined,
            includeServices: input.items.some(item => item.kind === 'service'), pricingcheckout: c.quote,
            nhismembershipid: c.nhisMembershipId, claimscheckcode: c.claimCheckCode,
            referalCode: c.referralCode || undefined,
        });
        if (!catalog || !Array.isArray(catalog.testList)) throw new Error(typeof catalog === 'string' ? catalog : catalog?.message || 'Unable to load the current billing catalogue');
        const tests: any[] = [];
        const services: any[] = [];
        const testRows = c.packageId ? (catalog.packageTestList?.length ? catalog.packageTestList : catalog.testList) : catalog.testList;
        const previous = Array.isArray(catalog.previousRecords) ? catalog.previousRecords : [];
        for (const selection of input.items) {
            const rows = selection.kind === 'test' ? testRows : (catalog.servicesList || []);
            const row = rows.find((entry: any) => Number(selection.kind === 'test' ? entry.testid || entry.id : entry.keyid || entry.id) === selection.id);
            if (!row) throw new Error(`A selected ${selection.kind} is no longer available. Reload the catalogue and review your selection.`);
            if (!c.billingId && previous.some((entry: any) => Number(entry.trackId) === selection.id && Number(entry.categoryTrackId) === (selection.kind === 'test' ? 1 : 5))) {
                throw new Error(`${row.name || row.serviceName} has already been billed`);
            }
            const hydrated: any = { ...row, prioritised: selection.prioritised ?? row.prioritised };
            if (selection.adjustment) Object.assign(hydrated, { userAdjustmentType: selection.adjustment.type, userAdjustedValue: selection.adjustment.value, discount: selection.adjustment.value });
            if (selection.kind === 'test' && Number(row.isoutsourced) === 1) {
                if (!selection.outsourceId) throw new Error(`Choose an outsourcing organization for ${row.name}`);
                const organizations = await this.services.organizations(actor.tenantId, selection.id);
                const organization = organizations.find(org => Number(org.outsourceid) === selection.outsourceId);
                if (!organization) throw new Error(`The outsourcing organization is unavailable for ${row.name}`);
                Object.assign(hydrated, { outsourceid: organization.outsourceid, organization, label: organization.name });
            }
            (selection.kind === 'test' ? tests : services).push(hydrated);
        }
        if (c.packageId && testRows.some((row: any) => !tests.some(item => Number(item.testid || item.id) === Number(row.testid || row.id)))) {
            throw new Error('A package must include all of its tests');
        }
        const result = await this.services.price({
            tenantId: actor.tenantId, employeeid: actor.employeeid, branchid: actor.branch,
            patientId: c.patientId, billingid: c.billingId || undefined, billingSource: c.billingSource,
            entitytype: catalog.entityType || entityType, entityid: catalog.entityId ?? c.entityId,
            cart: tests, servicesList: services, paymentDetails: null,
            referalCode: c.referralCode || '', promoCode: c.promoCode || '', isPromo: Boolean(c.promoCode),
            ispricingcheckout: c.quote, isPackageUsed: Boolean(c.packageId), packageid: c.packageId || undefined,
        });
        if (!result?.success || !result.data) throw new Error(result?.message || 'Unable to price the selected items');
        const preserveOptions = (rows: any[]) => rows.map(row => {
            const original = tests.find(item => Number(item.testid || item.id) === Number(row.testid || row.id));
            return original ? { ...row, prioritised: original.prioritised, ...(original.organization ? { organization: original.organization, outsourceid: original.outsourceid, label: original.label, isoutsourced: 1 } : {}) } : row;
        });
        const cart = preserveOptions(c.packageId ? result.data.packageTestList || [] : result.data.cart || []);
        const pricedServices = (result.data.servicesList || []).map((row: any) => ({
            ...row, prioritised: services.find(item => Number(item.keyid || item.id) === Number(row.keyid || row.id))?.prioritised,
        }));
        if (cart.length !== tests.length || pricedServices.length !== services.length ||
            tests.some(test => !cart.some(row => Number(row.testid || row.id) === Number(test.testid || test.id))) ||
            services.some(service => !pricedServices.some((row: any) => Number(row.keyid || row.id) === Number(service.keyid || service.id)))) {
            throw new Error('Pricing returned an incomplete selection. Reload and review the bill.');
        }
        return { ...result.data, cart, servicesProvided: pricedServices, reviewedAt: new Date().toISOString() };
    }
}
