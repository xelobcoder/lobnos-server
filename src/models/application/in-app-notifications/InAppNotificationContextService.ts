import { BillingRepo } from '../../billing/repositories/BillingRepo';
import { InventoryItemModel } from '../../inventory/InventoryItem';
import RolesRepository from '../../settings/users/RolesRepository';

export type NotificationReference = { type?: string; id?: number | string };

export class InAppNotificationContextService {
     private readonly billingRepo: BillingRepo;
     private readonly inventoryItemModel: InventoryItemModel;
     private readonly rolesRepository: RolesRepository;

     constructor(private readonly tenantId: number) {
          this.billingRepo = new BillingRepo(tenantId);
          this.inventoryItemModel = new InventoryItemModel(tenantId);
          this.rolesRepository = new RolesRepository(tenantId);
     }

     async buildMessage(eventCode: string, eventName: string, reference: NotificationReference, createdBy?: number): Promise<string> {
          const actor = createdBy ? await this.rolesRepository.getRoleById(createdBy) : null;
          const actorSuffix = actor?.username ? ` by ${actor.username}` : '';

          if (reference.type === 'billing' && reference.id) {
               const billing = await this.billingRepo.findNotificationContext(Number(reference.id));
               const patientName = billing?.patientName || `patient on billing #${reference.id}`;
               return `${eventName} for ${patientName}${actorSuffix}.`;
          }

          if (reference.type === 'service' && reference.id && (eventCode.startsWith('REFUND_') || eventCode === 'PAYMENT_REFUNDED')) {
               const refund = await this.billingRepo.findRefundNotificationContext(Number(reference.id));
               const patientName = refund?.patientName || `service #${reference.id}`;
               const amount = refund?.amountRefunded == null ? '' : ` of ${refund.amountRefunded}`;
               return `${eventName}${amount} for ${patientName}${actorSuffix}.`;
          }

          if (reference.type === 'inventory' && reference.id) {
               const inventory = await this.inventoryItemModel.findById(String(reference.id));
               return `${eventName} for ${inventory?.name || `inventory item #${reference.id}`}${actorSuffix}.`;
          }

          return `${eventName}${reference.type && reference.id ? ` for ${reference.type} #${reference.id}` : ''}${actorSuffix}.`;
     }
}