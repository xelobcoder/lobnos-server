import test from 'node:test';
import assert from 'node:assert/strict';
import { EmailTemplatesService } from '../services/EmailTemplatesService';
import { TemplateRenderer } from '../services/TemplateRenderer';

test('EmailTemplatesService.create maps DTO fields for persistence', async () => {
     let captured: any;
     const repo = {
          create: async (payload: any) => {
               captured = payload;
               return 15;
          },
     };

     const service = new EmailTemplatesService(repo as any, new TemplateRenderer());
     const id = await service.create({
          name: 'Result Ready',
          category: 'patient',
          subject: 'Hello {{PatientName}}',
          htmlBody: '<p>Ready</p>',
          plainTextBody: 'Ready',
          variables: ['PatientName'],
          status: 'active',
          createdBy: 4,
          updatedBy: 4,
     });

     assert.equal(id, 15);
     assert.deepEqual(captured, {
          name: 'Result Ready',
          category: 'patient',
          subject: 'Hello {{PatientName}}',
          html_body: '<p>Ready</p>',
          plain_text_body: 'Ready',
          variables_json: JSON.stringify(['PatientName']),
          status: 'active',
          created_by: 4,
          updated_by: 4,
     });
});

test('EmailTemplatesService.preview renders a stored template', async () => {
     const repo = {
          findById: async () => ({
               id: 1,
               name: 'Preview',
               category: 'patient',
               subject: 'Hi {{PatientName}}',
               html_body: '<p>{{PatientName}}</p>',
               plain_text_body: '{{PatientName}}',
               variables_json: '[]',
               status: 'active',
          }),
     };

     const service = new EmailTemplatesService(repo as any, new TemplateRenderer());
     const result = await service.preview(1, { PatientName: 'Kojo' });

     assert.equal(result.subject, 'Hi Kojo');
     assert.equal(result.htmlBody, '<p>Kojo</p>');
     assert.equal(result.plainTextBody, 'Kojo');
});

test('EmailTemplatesService.preview throws when template is missing', async () => {
     const repo = { findById: async () => null };
     const service = new EmailTemplatesService(repo as any, new TemplateRenderer());

     await assert.rejects(() => service.preview(1, {}), /Template not found/);
});
