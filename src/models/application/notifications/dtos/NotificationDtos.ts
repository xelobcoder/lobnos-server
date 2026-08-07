import { z } from 'zod';

export const CreateNotificationTemplateSchema = z.object({
     eventCode: z.string().min(1).max(100),
     templateName: z.string().min(1).max(255),
     subject: z.string().min(1).max(500),
     htmlBody: z.string().optional().nullable(),
     plainBody: z.string().optional().nullable(),
     isDefault: z.boolean().optional().default(false),
     isActive: z.boolean().optional().default(true),
     createdBy: z.number().int().nonnegative().optional().nullable(),
});

export const UpdateNotificationTemplateSchema = CreateNotificationTemplateSchema.partial().omit({
     eventCode: true,
     createdBy: true,
}).extend({
     updatedBy: z.number().int().nonnegative().optional().nullable(),
});

export const PreviewTemplateSchema = z.object({
     variables: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional().default({}),
});

export const UpdateNotificationEventSettingsSchema = z.object({
     emailEnabled: z.boolean().optional(),
     smsEnabled: z.boolean().optional(),
     whatsappEnabled: z.boolean().optional(),
     inAppEnabled: z.boolean().optional(),
     defaultTemplateId: z.number().int().positive().optional().nullable(),
});

export const TriggerNotificationSchema = z.object({
     eventCode: z.string().min(1).max(100),
     context: z.record(z.string(), z.unknown()).optional().default({}),
     priority: z.enum(['low', 'normal', 'high']).optional().default('normal'),
     scheduledAt: z.string().datetime().optional().nullable(),
     createdBy: z.number().int().nonnegative().optional().nullable(),
     recipients: z.object({
          to: z.array(z.string().email()).optional().default([]),
          cc: z.array(z.string().email()).optional().default([]),
          bcc: z.array(z.string().email()).optional().default([]),
     }).optional(),
});

export const TriggerNotificationByReferenceSchema = z.object({
     eventCode: z.string().min(1).max(100),
     references: z.object({
          patientId: z.union([z.number().int().positive(), z.string().min(1)]).optional(),
          appointmentId: z.union([z.number().int().positive(), z.string().min(1)]).optional(),
          ascensionId: z.union([z.number().int().positive(), z.string().min(1)]).optional(),
          billingId: z.union([z.number().int().positive(), z.string().min(1)]).optional(),
          userId: z.union([z.number().int().positive(), z.string().min(1)]).optional(),
          payrollId: z.union([z.number().int().positive(), z.string().min(1)]).optional(),
          purchaseOrderId: z.union([z.number().int().positive(), z.string().min(1)]).optional(),
          supplierId: z.union([z.number().int().positive(), z.string().min(1)]).optional(),
          supplierPaymentId: z.union([z.number().int().positive(), z.string().min(1)]).optional(),
          inventoryId: z.union([z.number().int().positive(), z.string().min(1)]).optional(),
          doctorId: z.union([z.number().int().positive(), z.string().min(1)]).optional(),
     }).optional().default({}),
     context: z.record(z.string(), z.unknown()).optional().default({}),
     priority: z.enum(['low', 'normal', 'high']).optional().default('normal'),
     scheduledAt: z.string().datetime().optional().nullable(),
     createdBy: z.number().int().nonnegative().optional().nullable(),
     recipients: z.object({
          to: z.array(z.string().email()).optional().default([]),
          cc: z.array(z.string().email()).optional().default([]),
          bcc: z.array(z.string().email()).optional().default([]),
     }).optional(),
});

export type CreateNotificationTemplateDto = z.infer<typeof CreateNotificationTemplateSchema>;
export type UpdateNotificationTemplateDto = z.infer<typeof UpdateNotificationTemplateSchema>;
export type PreviewTemplateDto = z.infer<typeof PreviewTemplateSchema>;
export type UpdateNotificationEventSettingsDto = z.infer<typeof UpdateNotificationEventSettingsSchema>;
export type TriggerNotificationDto = z.infer<typeof TriggerNotificationSchema>;
export type TriggerNotificationByReferenceDto = z.infer<typeof TriggerNotificationByReferenceSchema>;
