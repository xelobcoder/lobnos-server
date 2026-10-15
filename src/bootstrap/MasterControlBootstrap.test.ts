import { describe, expect, it } from 'vitest';
import { compatibleColumnMapping, missingControlCatalogTables } from './MasterControlBootstrap';

describe('compatibleColumnMapping', () => {
     it('maps facility and master columns case-insensitively and ignores legacy-only fields', () => {
          const mapping = compatibleColumnMapping(
               { id: 1, createdBy: 3, legacyValue: 'ignored' },
               [
                    { COLUMN_NAME: 'id', IS_NULLABLE: 'NO', COLUMN_DEFAULT: null, EXTRA: 'auto_increment' },
                    { COLUMN_NAME: 'createdby', IS_NULLABLE: 'NO', COLUMN_DEFAULT: null, EXTRA: '' },
               ],
               'testconditiondefinitions',
          );
          expect(mapping.map(entry => [entry.target, entry.source])).toEqual([
               ['id', 'id'],
               ['createdby', 'createdBy'],
          ]);
     });

     it('fails before insertion when the existing master table requires unavailable data', () => {
          expect(() => compatibleColumnMapping(
               { id: 1 },
               [
                    { COLUMN_NAME: 'id', IS_NULLABLE: 'NO', COLUMN_DEFAULT: null, EXTRA: 'auto_increment' },
                    { COLUMN_NAME: 'required_name', IS_NULLABLE: 'NO', COLUMN_DEFAULT: null, EXTRA: '' },
               ],
               'catalog',
          )).toThrow('required columns are missing: required_name');
     });
});

describe('master-control catalog schema reconciliation', () => {
     it('creates only tables absent from the existing schema, ignoring identifier case', () => {
          expect(missingControlCatalogTables(
               ['roles', 'test_panels', 'testconditiondefinitions'],
               ['ROLES', 'test_panels'],
          )).toEqual(['testconditiondefinitions']);
     });

     it('does not request DDL for an already complete catalog schema', () => {
          expect(missingControlCatalogTables(['roles', 'test_panels'], ['roles', 'test_panels'])).toEqual([]);
     });
});
