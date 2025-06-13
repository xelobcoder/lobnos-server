interface LoggingCriticalValueAlert {
    crkeyId: number;
    billingid: number;
    testid: number;
    statement: string;
    createdOn: Date;
    createdBy: number;
    isSeen?: number;
    isSeenBy?: number;
}