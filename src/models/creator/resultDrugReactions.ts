export function buildStaleDrugReactionDelete(
     ascensionId: number,
     testId: number,
     submittedDrugIds: number[]
): { query: string; params: number[] } {
     const drugIds = [...new Set(submittedDrugIds)]
          .filter((drugId) => Number.isInteger(drugId) && drugId > 0);
     const query = drugIds.length > 0
          ? `DELETE FROM resultentrydrugsreaction WHERE ascensionid = ? AND testid = ? AND drugid NOT IN (${drugIds.map(() => '?').join(', ')})`
          : 'DELETE FROM resultentrydrugsreaction WHERE ascensionid = ? AND testid = ?';

     return { query, params: [ascensionId, testId, ...drugIds] };
}