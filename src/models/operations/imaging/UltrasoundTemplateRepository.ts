import { z } from 'zod';
import KnexConnection from '../../../database/KnexConnections';

const positiveId = z.union([z.number(), z.string().regex(/^[1-9]\d*$/)]).pipe(z.coerce.number().int().positive().safe());
const fieldSchema = z.object({
     name: z.string().trim().min(1).max(100).optional(),
     field: z.string().trim().min(1).max(100).optional(),
     id: positiveId.optional(),
     fieldid: positiveId.optional(),
     value: z.string(),
}).transform((field, context) => {
     const name = field.field ?? field.name;
     const id = field.fieldid ?? field.id;
     if (!name || !id) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: 'Each template field needs a name and field ID' });
          return z.NEVER;
     }
     return { field: name, fieldid: id, value: field.value };
});

export const ultrasoundTemplateSchema = z.object({
     keyid: positiveId.nullish(),
     testid: positiveId,
     employeeid: positiveId,
     name: z.string().trim().min(1).max(50),
     associatedbodypart: z.string().trim().min(1).max(50),
     visibleToAll: z.union([z.literal(0), z.literal(1), z.literal('0'), z.literal('1'), z.boolean()]).transform(Number),
     fields: z.array(fieldSchema).min(1),
});
export type UltrasoundTemplateInput = z.infer<typeof ultrasoundTemplateSchema>;

export class UltrasoundTemplateRepository {
     constructor(private tenantId: number) {}

     async create(template: UltrasoundTemplateInput): Promise<boolean> {
          const connection = await KnexConnection(this.tenantId);
          return connection.transaction(async trx => {
               const [templateId] = await trx('ultrasoundtemplatesmapper').insert({
                    testid: template.testid, name: template.name, createdby: template.employeeid,
                    visibletoAll: template.visibleToAll, associatedbodypart: template.associatedbodypart,
               });
               if (!templateId) throw new Error('Ultrasound template creation did not return an ID');
               await trx('ultrasoundtemplates').insert(template.fields.map(field => ({ ...field, templateid: templateId })));
               return true;
          });
     }

     async update(template: UltrasoundTemplateInput & { keyid: number }): Promise<boolean> {
          const connection = await KnexConnection(this.tenantId);
          return connection.transaction(async trx => {
               const existing = await trx('ultrasoundtemplatesmapper').where({ keyid: template.keyid }).forUpdate().first('keyid');
               if (!existing) return false;
               await trx('ultrasoundtemplatesmapper').where({ keyid: template.keyid }).update({
                    name: template.name, visibletoAll: template.visibleToAll, associatedbodypart: template.associatedbodypart,
               });
               for (const field of template.fields) {
                    const query = () => trx('ultrasoundtemplates').where({ templateid: template.keyid, field: field.field });
                    if (await query().first('keyid')) {
                         await query().update({ ...field, lastupdatedon: trx.fn.now() });
                    } else {
                         await trx('ultrasoundtemplates').insert({ ...field, templateid: template.keyid });
                    }
               }
               return true;
          });
     }

     async delete(templateId: number, employeeId: number, canManageAll: boolean): Promise<'deleted' | 'not_found' | 'forbidden'> {
          const connection = await KnexConnection(this.tenantId);
          return connection.transaction(async trx => {
               const template = await trx('ultrasoundtemplatesmapper').where({ keyid: templateId }).forUpdate().first('createdby');
               if (!template) return 'not_found';
               if (!canManageAll && Number(template.createdby) !== employeeId) return 'forbidden';
               await trx('ultrasoundtemplates').where({ templateid: templateId }).del();
               await trx('ultrasoundtemplatesmapper').where({ keyid: templateId }).del();
               return 'deleted';
          });
     }
}
