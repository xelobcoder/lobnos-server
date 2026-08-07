import test from 'node:test';
import assert from 'node:assert/strict';
import { TemplateRenderer } from '../services/TemplateRenderer';

test('TemplateRenderer replaces placeholders across subject and bodies', () => {
     const renderer = new TemplateRenderer();

     const result = renderer.render(
          'Hello {{PatientName}}',
          '<p>{{PatientName}} your invoice is {{InvoiceNumber}}</p>',
          'Invoice {{InvoiceNumber}} for {{PatientName}}',
          {
               PatientName: 'Ama',
               InvoiceNumber: 'INV-001',
          },
     );

     assert.equal(result.subject, 'Hello Ama');
     assert.equal(result.htmlBody, '<p>Ama your invoice is INV-001</p>');
     assert.equal(result.plainTextBody, 'Invoice INV-001 for Ama');
});

test('TemplateRenderer blanks unknown placeholders', () => {
     const renderer = new TemplateRenderer();
     const result = renderer.render('Hi {{Unknown}}', '{{Known}}/{{Unknown}}', '', { Known: 'ok' });

     assert.equal(result.subject, 'Hi ');
     assert.equal(result.htmlBody, 'ok/');
});
