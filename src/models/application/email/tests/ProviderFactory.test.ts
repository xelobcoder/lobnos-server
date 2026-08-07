import test from 'node:test';
import assert from 'node:assert/strict';
import { ProviderFactory } from '../services/ProviderFactory';

test('ProviderFactory creates an SMTP provider for smtp records', () => {
     const factory = new ProviderFactory();
     const provider = factory.create({
          id: 1,
          name: 'SMTP',
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
     });

     assert.equal(typeof provider.send, 'function');
     assert.equal(typeof provider.testConnection, 'function');
});