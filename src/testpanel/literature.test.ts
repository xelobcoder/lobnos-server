import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../hooks/helper', () => ({ promisifyQuery: mocks.query }));
vi.mock('../hooks/logger', () => ({ default: { error: vi.fn() } }));

import TestLiteratureSetup from './literature';

describe('test literature visibility', () => {
     beforeEach(() => mocks.query.mockReset());

     it.each([1, '1'])('returns configured literature when useLiterature is %s', async useLiterature => {
          mocks.query.mockResolvedValueOnce([{ useLiterature }]).mockResolvedValueOnce([{ literature: 'Reference notes' }]);

          await expect(new TestLiteratureSetup('').getResultLiterature(4, 8))
               .resolves.toEqual({ can: true, literature: 'Reference notes' });
     });

     it('does not return literature when the test setting is disabled', async () => {
          mocks.query.mockResolvedValueOnce([{ useLiterature: 0 }]);

          await expect(new TestLiteratureSetup('').getResultLiterature(4, 8)).resolves.toEqual({ can: false });
          expect(mocks.query).toHaveBeenCalledTimes(1);
     });
});
