import { NotificationEventsRepo } from '../src/models/application/notifications/repositories/NotificationEventsRepo';
import { NotificationTemplatesRepo } from '../src/models/application/notifications/repositories/NotificationTemplatesRepo';
import { NotificationTemplateVariablesRepo } from '../src/models/application/notifications/repositories/NotificationTemplateVariablesRepo';
import { NotificationTemplateVersionsRepo } from '../src/models/application/notifications/repositories/NotificationTemplateVersionsRepo';
import { NotificationEventContextService } from '../src/models/application/notifications/services/NotificationEventContextService';
import { AppointmentContextProvider } from '../src/models/application/notifications/context/providers/AppointmentContextProvider';
import { DoctorContextProvider } from '../src/models/application/notifications/context/providers/DoctorContextProvider';
import { InventoryContextProvider } from '../src/models/application/notifications/context/providers/InventoryContextProvider';
import { InvoiceContextProvider } from '../src/models/application/notifications/context/providers/InvoiceContextProvider';
import { LaboratoryContextProvider } from '../src/models/application/notifications/context/providers/LaboratoryContextProvider';
import { PatientContextProvider } from '../src/models/application/notifications/context/providers/PatientContextProvider';
import { PayrollContextProvider } from '../src/models/application/notifications/context/providers/PayrollContextProvider';
import { PurchaseOrderContextProvider } from '../src/models/application/notifications/context/providers/PurchaseOrderContextProvider';
import { SampleContextProvider } from '../src/models/application/notifications/context/providers/SampleContextProvider';
import { SupplierContextProvider } from '../src/models/application/notifications/context/providers/SupplierContextProvider';

function parseArgs(argv: string[]) {
     const args: Record<string, string> = {};
     for (let i = 2; i < argv.length; i += 1) {
          const token = argv[i];
          if (!token.startsWith('--')) continue;
          const key = token.slice(2);
          const next = argv[i + 1];
          if (!next || next.startsWith('--')) {
               args[key] = 'true';
          } else {
               args[key] = next;
               i += 1;
          }
     }
     return args;
}

function asNumber(value: string | undefined, fallback: number): number {
     const parsed = Number(value);
     return Number.isFinite(parsed) ? parsed : fallback;
}

function nonEmptyText(value: unknown): boolean {
     return typeof value === 'string' && value.trim().length > 0;
}

type ProviderEntry = {
     name: string;
     provider: {
          supportsEvent?: (eventCode: string) => boolean;
          getEventDefinition?: (eventCode: string) => any;
     };
};

async function main() {
     const args = parseArgs(process.argv);
     const tenantId = asNumber(args.tenantId, 1);

     const eventsRepo = new NotificationEventsRepo(tenantId);
     const templatesRepo = new NotificationTemplatesRepo(tenantId);
     const variablesRepo = new NotificationTemplateVariablesRepo(tenantId);
     const versionsRepo = new NotificationTemplateVersionsRepo(tenantId);

     const contextService = new NotificationEventContextService(
          eventsRepo,
          templatesRepo,
          variablesRepo,
          versionsRepo,
          tenantId,
     );

     // Ensure default variables/templates are synchronized with current provider ownership.
     await contextService.ensureSystemDefinitions();

     const providers: ProviderEntry[] = [
          { name: 'patient', provider: new PatientContextProvider(tenantId) },
          { name: 'appointment', provider: new AppointmentContextProvider(tenantId) },
          { name: 'sample', provider: new SampleContextProvider(tenantId) },
          { name: 'laboratory', provider: new LaboratoryContextProvider(tenantId) },
          { name: 'invoice', provider: new InvoiceContextProvider(tenantId) },
          { name: 'payroll', provider: new PayrollContextProvider(tenantId) },
          { name: 'purchase-order', provider: new PurchaseOrderContextProvider(tenantId) },
          { name: 'supplier', provider: new SupplierContextProvider(tenantId) },
          { name: 'inventory', provider: new InventoryContextProvider(tenantId) },
          { name: 'doctor', provider: new DoctorContextProvider(tenantId) },
     ];

     const events = await eventsRepo.findAll();
     const failures: string[] = [];
     const warnings: string[] = [];

     for (const event of events) {
          const code = event.event_code;

          const owners = providers.filter((entry) => entry.provider.supportsEvent?.(code));
          if (owners.length === 0) {
               failures.push(`${code}: no specialized provider supports this event code`);
               continue;
          }

          if (owners.length > 1) {
               warnings.push(`${code}: multiple providers support this event (${owners.map((o) => o.name).join(', ')})`);
          }

          const primary = owners[0];
          const definition = primary.provider.getEventDefinition?.(code);
          if (!definition) {
               failures.push(`${code}: provider ${primary.name} does not return event definition`);
               continue;
          }

          if (!nonEmptyText(definition.template?.html_body)) {
               failures.push(`${code}: provider definition html_body is empty`);
          }

          if (!nonEmptyText(definition.template?.plain_body)) {
               failures.push(`${code}: provider definition plain_body is empty`);
          }

          const persisted = await templatesRepo.findSystemDefaultForEvent(event.id as number);
          if (!persisted) {
               failures.push(`${code}: no persisted default template found in database`);
               continue;
          }

          if (!nonEmptyText(persisted.html_body)) {
               failures.push(`${code}: persisted default html_body is empty`);
          }

          if (!nonEmptyText(persisted.plain_body)) {
               failures.push(`${code}: persisted default plain_body is empty`);
          }
     }

     console.log(`Tenant: ${tenantId}`);
     console.log(`Events checked: ${events.length}`);

     if (warnings.length > 0) {
          console.log(`Warnings: ${warnings.length}`);
          for (const warning of warnings) {
               console.log(`WARN  ${warning}`);
          }
     }

     if (failures.length > 0) {
          console.log(`Failures: ${failures.length}`);
          for (const failure of failures) {
               console.log(`FAIL  ${failure}`);
          }
          process.exit(1);
     }

     console.log('PASS  All event codes are specialized and have non-empty default HTML/plain templates (provider + persisted DB).');
}

main().catch((error) => {
     console.error('Verification failed to run');
     console.error(error instanceof Error ? error.message : error);
     process.exit(1);
});
