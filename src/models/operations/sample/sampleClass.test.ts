import { describe, expect, it } from 'vitest';
import { isSampleValidationBypassed } from './sampleClass';

describe('sample validation bypass status', () => {
     it('recognizes enabled, disabled and missing facility settings', () => {
          expect(isSampleValidationBypassed({ byPassSampleValidation: 1 })).toBe(true);
          expect(isSampleValidationBypassed({ byPassSampleValidation: '1' })).toBe(true);
          expect(isSampleValidationBypassed({ byPassSampleValidation: 0 })).toBe(false);
          expect(isSampleValidationBypassed({})).toBe(false);
     });
});
