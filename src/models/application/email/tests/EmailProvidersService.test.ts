import test from 'node:test';
import assert from 'node:assert/strict';
import { EmailProvidersService } from '../services/EmailProvidersService';

test('EmailProvidersService.create maps provider DTO fields', async () => {
     let captured: any;
     const repo = {
          create: async (payload: any) => {
               captured = payload;
               return 7;
          },
     };

     const factory = { create: () => ({ testConnection: async () => true }) };
     const service = new EmailProvidersService(repo as any, factory as any);

     const id = await service.create({
          name: 'Primary SMTP',
          providerType: 'smtp',
          host: 'smtp.example.com',
          port: 587,
          secure: false,
          username: 'user',
          password: 'pass',
          fromEmail: 'lab@example.com',
          fromName: 'Prime Lab',
          isDefault: true,
          isActive: true,
          createdBy: 3,
          updatedBy: 3,
     });

     assert.equal(id, 7);
     assert.deepEqual(captured, {
          name: 'Primary SMTP',
          provider_type: 'smtp',
          host: 'smtp.example.com',
          port: 587,
          secure: false,
          username: 'user',
          password: 'pass',
          from_email: 'lab@example.com',
          from_name: 'Prime Lab',
          is_default: true,
          is_active: true,
          created_by: 3,
          updated_by: 3,
     });
});

test('EmailProvidersService.testProvider delegates to provider factory', async () => {
     let tested = false;
     const provider = {
          id: 2,
          name: 'SMTP',
          provider_type: 'smtp',
          host: 'smtp.example.com',
          port: 465,
          secure: true,
          username: 'user',
          password: 'pass',
          from_email: 'lab@example.com',
          from_name: 'Prime Lab',
          is_default: true,
          is_active: true,
     };
     const repo = { findById: async () => provider };
     const factory = {
          create: (resolved: any) => {
               assert.equal(resolved, provider);
               return {
                    testConnection: async () => {
                         tested = true;
                         return true;
                    },
               };
          },
     };

     const service = new EmailProvidersService(repo as any, factory as any);
     const result = await service.testProvider(2);

     assert.equal(result, true);
     assert.equal(tested, true);
});

test('EmailProvidersService.testProvider throws when provider does not exist', async () => {
     const repo = { findById: async () => null };
     const factory = { create: () => ({ testConnection: async () => true }) };
     const service = new EmailProvidersService(repo as any, factory as any);

     await assert.rejects(() => service.testProvider(999), /Provider not found/);
});
