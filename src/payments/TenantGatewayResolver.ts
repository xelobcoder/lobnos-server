import { PaymentGatewayConfig, loadPaymentGatewayConfig } from './PaymentGatewayConfig';
import { TenantGatewayStore } from './TenantGatewayStore';
import { HubtelAdapter } from './adapters/HubtelAdapter';
import { PaySwitchAdapter } from './adapters/PaySwitchAdapter';
import { PaystackAdapter } from './adapters/PaystackAdapter';
import { GatewayProvider, IPaymentGatewayAdapter, ITenantGatewayResolver, TenantGateway } from './types';

export function buildAdapter(provider: GatewayProvider, config: PaymentGatewayConfig): IPaymentGatewayAdapter {
     switch (provider) {
          case 'paystack': return new PaystackAdapter(config);
          case 'hubtel': return new HubtelAdapter(config);
          case 'payswitch': return new PaySwitchAdapter(config);
     }
}

/**
 * Builds an adapter that holds only the tenant's own credentials for one provider. Every credential field is set
 * explicitly from the tenant's row, so platform credentials in the environment can never be used on a tenant's behalf.
 */
export function tenantAdapterConfig(base: PaymentGatewayConfig, provider: GatewayProvider, credentials: Record<string, string>): PaymentGatewayConfig {
     const field = (name: string) => credentials[name] ?? '';
     switch (provider) {
          case 'paystack':
               return { ...base, paystack: { ...base.paystack, secretKey: field('secretKey') } };
          case 'hubtel':
               return { ...base, hubtel: { ...base.hubtel, clientId: field('clientId'), clientSecret: field('clientSecret'), merchantAccount: field('merchantAccount') } };
          case 'payswitch':
               return { ...base, payswitch: { ...base.payswitch, apiUser: field('apiUser'), apiKey: field('apiKey'), merchantId: field('merchantId') } };
     }
}

export class TenantGatewayResolver implements ITenantGatewayResolver {
     constructor(
          private store: TenantGatewayStore,
          private baseConfig: () => PaymentGatewayConfig = () => loadPaymentGatewayConfig(),
     ) { }

     async resolve(tenantId: number, provider: GatewayProvider): Promise<TenantGateway | null> {
          const settings = await this.store.load(tenantId, provider);
          if (!settings || !settings.enabled) return null;
          const adapter = buildAdapter(provider, tenantAdapterConfig(this.baseConfig(), provider, settings.credentials));
          if (!adapter.isConfigured()) return null;
          return { adapter, currency: settings.currency };
     }
}
