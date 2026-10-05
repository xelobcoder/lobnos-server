import { describe, expect, it } from 'vitest';
import { buildStaleDrugReactionDelete } from './resultDrugReactions';

describe('buildStaleDrugReactionDelete', () => {
     it('limits cleanup to this ascension and test while preserving submitted drugs', () => {
          const deletion = buildStaleDrugReactionDelete(27074, 100151, [12, 24, 24]);

          expect(deletion.query).toBe(
               'DELETE FROM resultentrydrugsreaction WHERE ascensionid = ? AND testid = ? AND drugid NOT IN (?, ?)'
          );
          expect(deletion.params).toEqual([27074, 100151, 12, 24]);
     });

     it('clears all reaction rows only for this ascension and test when selection is empty', () => {
          const deletion = buildStaleDrugReactionDelete(27074, 100151, []);

          expect(deletion.query).toBe(
               'DELETE FROM resultentrydrugsreaction WHERE ascensionid = ? AND testid = ?'
          );
          expect(deletion.params).toEqual([27074, 100151]);
     });
});