export interface IFinancialFinalizationGuard {
     /** Rejects mutations dated inside a finalized branch/day. */
     assertDateOpen(branchId: number, date: Date | string): Promise<void>;

     /** Rejects mutations to a source row already included in a finalized manifest. */
     assertRecordMutable(sourceTable: string, sourceRef: string | number): Promise<void>;
}
