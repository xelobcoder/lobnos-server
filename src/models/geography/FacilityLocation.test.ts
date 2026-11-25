import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accountingSqlDatabase } from '../../testSupport/accountingSqlDatabase';

const mocks = vi.hoisted(() => ({ connection: vi.fn() }));
vi.mock('../../database/KnexConnections', () => ({ default: mocks.connection }));

import { FacilityLocationError, getFacilityLocation, setFacilityLocation } from './FacilityLocation';

let fixture: ReturnType<typeof accountingSqlDatabase>;

beforeEach(() => {
     fixture = accountingSqlDatabase();
     mocks.connection.mockResolvedValue(fixture.db);
});

afterEach(async () => {
     await fixture.db.destroy();
     vi.clearAllMocks();
});

describe('facility location', () => {
     it('defaults to Ghana when a converted tenant has no company profile table', async () => {
          await expect(getFacilityLocation(42)).resolves.toEqual({ countryCode: 'GH', state: null });
     });

     it('reports a clear error when saving a location before the company profile exists', async () => {
          await expect(setFacilityLocation(43, { countryCode: 'NG', state: 'Lagos' }))
               .rejects.toThrow(new FacilityLocationError('Save the company profile before choosing a country'));
     });
});
