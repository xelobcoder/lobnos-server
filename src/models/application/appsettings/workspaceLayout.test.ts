import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ connection: vi.fn(), query: vi.fn() }));
vi.mock('../../../database/KnexConnections', () => ({ default: mocks.connection }));
vi.mock('../../../hooks/helper', () => ({ promisifyQuery: mocks.query }));
vi.mock('./services/regions-districts-service', () => ({ default: class {} }));

import ApplicationSettings from './appset';
import { isWorkspaceLayout } from './workspaceLayout';

describe('workspace layout settings', () => {
     beforeEach(() => vi.clearAllMocks());

     it.each(['classic', 'zoho', 'claude', 'ribbon'])('accepts %s', value => {
          expect(isWorkspaceLayout(value)).toBe(true);
     });
     it.each([undefined, null, '', 'Classic', ' classic', 'zoho ', 'modern', 1, {}, ['claude']])('rejects %j', value => {
          expect(isWorkspaceLayout(value)).toBe(false);
     });

     it.each(['classic', 'zoho', 'claude', 'ribbon', undefined, null, 'invalid'])('exposes %j as normal application settings', async value => {
          mocks.query.mockResolvedValue([{ keyid: 1, workspaceLayout: value, services: '{"enabled":true}' }]);
          const result = await new ApplicationSettings().getAllAppSettings(42);
          expect(mocks.query).toHaveBeenCalledWith(42, 'SELECT * FROM applicationsettings');
          expect(result.workspaceLayout).toBe(isWorkspaceLayout(value) ? value : 'classic');
          expect(result.services).toEqual({ enabled: true });
     });
     it('preserves the empty settings contract', async () => {
          mocks.query.mockResolvedValue([]);
          expect(await new ApplicationSettings().getAllAppSettings(42)).toBeNull();
     });

     function tenant(existing: any = { keyid: 1, workspaceLayout: 'classic', headerColor: '#fff' }) {
          const first = vi.fn().mockResolvedValue(existing);
          const update = vi.fn().mockResolvedValue(0); // MySQL can report no changes for an identical value.
          const builder = { where: vi.fn().mockReturnThis(), forUpdate: vi.fn().mockReturnThis(), first, update };
          const trx = vi.fn(() => builder);
          const transaction = vi.fn(async action => action(trx));
          return { builder, trx, transaction, db: { transaction } };
     }
     it('awaits the tenant connection and only updates the singleton column in a transaction', async () => {
          const a = tenant();
          const b = tenant();
          mocks.connection.mockImplementation(async id => id === 42 ? a.db : b.db);
          await expect(new ApplicationSettings().updateWorkspaceLayout(42, 'zoho')).resolves.toBe(true);
          expect(mocks.connection).toHaveBeenCalledWith(42);
          expect(a.transaction).toHaveBeenCalledOnce();
          expect(a.trx).toHaveBeenCalledWith('applicationsettings');
          expect(a.builder.where).toHaveBeenCalledWith({ keyid: 1 });
          expect(a.builder.forUpdate).toHaveBeenCalledOnce();
          expect(a.builder.update).toHaveBeenCalledWith({ workspaceLayout: 'zoho' });
          expect(b.transaction).not.toHaveBeenCalled();
     });
     it('allows an idempotent PATCH without treating zero changed rows as failure', async () => {
          const t = tenant();
          mocks.connection.mockResolvedValue(t.db);
          await expect(new ApplicationSettings().updateWorkspaceLayout(42, 'classic')).resolves.toBe(true);
     });
     it('does not insert incomplete settings or update other rows when singleton is missing', async () => {
          const t = tenant(null);
          mocks.connection.mockResolvedValue(t.db);
          await expect(new ApplicationSettings().updateWorkspaceLayout(42, 'claude')).resolves.toBe(false);
          expect(t.builder.update).not.toHaveBeenCalled();
     });
     it('preserves the persisted layout when legacy general settings are saved', async () => {
          const t = tenant({ keyid: 1, workspaceLayout: 'claude' });
          t.builder.update.mockResolvedValue(1);
          mocks.connection.mockResolvedValue(t.db);
          await new ApplicationSettings().updateApplicationSettings(42, { workspaceLayout: 'zoho' } as any);
          // Only the dedicated validated PATCH writes this column; the legacy settings form cannot reset it.
          expect(t.builder.update).toHaveBeenCalledOnce();
          expect(t.builder.update.mock.calls[0][0]).not.toHaveProperty('workspaceLayout');
     });
     it('persists SMS activation and keeps the legacy services flag synchronized', async () => {
          const t = tenant({ keyid: 1, smsActivated: 0, services: '{}' });
          t.builder.update.mockResolvedValue(1);
          mocks.connection.mockResolvedValue(t.db);
          await new ApplicationSettings().updateApplicationSettings(42, {
               smsActivated: 1,
               services: { isConnectedInventory: 1 },
          } as any);
          const record = t.builder.update.mock.calls[0][0];
          expect(record.smsActivated).toBe(1);
          expect(JSON.parse(record.services)).toMatchObject({
               isConnectedInventory: 1,
               isSmsServicesConnected: 1,
          });
     });
     it('preserves SMS activation when an older settings client omits the field', async () => {
          const t = tenant({ keyid: 1, smsActivated: 1, services: '{"isConnectedInventory":1}' });
          t.builder.update.mockResolvedValue(1);
          mocks.connection.mockResolvedValue(t.db);
          await new ApplicationSettings().updateApplicationSettings(42, {} as any);
          const record = t.builder.update.mock.calls[0][0];
          expect(record.smsActivated).toBe(1);
          expect(JSON.parse(record.services)).toMatchObject({
               isConnectedInventory: 1,
               isSmsServicesConnected: 1,
          });
     });
     it('validates at the data boundary before resolving any connection', async () => {
          await expect(new ApplicationSettings().updateWorkspaceLayout(42, 'injected' as any)).rejects.toThrow('Invalid workspaceLayout');
          expect(mocks.connection).not.toHaveBeenCalled();
     });
     it('propagates failed writes to the transaction', async () => {
          const t = tenant();
          t.builder.update.mockRejectedValue(new Error('write failed'));
          mocks.connection.mockResolvedValue(t.db);
          await expect(new ApplicationSettings().updateWorkspaceLayout(42, 'claude')).rejects.toThrow('write failed');
     });
});
