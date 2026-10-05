import { describe, expect, it, vi } from 'vitest';

vi.mock('../../utils/encryptionModels', () => ({
     encrypt_resources: ({ resources }: { resources: any[] }) => ({ resources }),
     decrypt_resources: ({ resources }: { resources: any[] }) => ({ resources }),
}));

import resultEncrptionReferer from './resultEncryptionReferer';

describe('resultEncrptionReferer', () => {
     it('preserves a calculated numeric zero', async () => {
          const result = await resultEncrptionReferer([{
               field: 'Calculated value',
               fieldid: 8,
               value: 0,
               originalvalue: '0',
               entrymode: 'calculated',
          }]);

          expect(result?.resources).toHaveLength(1);
          expect(result?.resources[0]).toMatchObject({ value: '0', originalvalue: '0', entrymode: 'calculated' });
     });
});