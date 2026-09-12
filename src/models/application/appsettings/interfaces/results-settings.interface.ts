export interface ResultEntrySettings {
     resultLockAfter24Hours: number;
     isPinOnResultEntry: number;
     isPinOnResultViewAfter24Hours: number;
     maximumResultValidation: number;
     minimumResultValidation: number;
     staffQualifiedToValidationResult: number[];
     showPastTestResult: number;
     allowScientistViewAudit: number;
     showTaTAnalysis: number;
     encryptResultAfter24Hours: number;
     sendLoginEmailNotificationAfterResultEdit: number;
     monitorForCriticalValues: number;
     notifyClientOnResultReady: number;
     notificationType: 'Email' | "SMS" | "WhatApp" | "Phone Call";
}





export interface ApplicationResultSettings {
     fontfamily: string;
     testnameColor: string;
     testnameBackgroundColor: string;
     testnameFontSize: number;
     mainReportHeaderBgColor: string;
     testTableHeaderBackgroundColor: string;
     comments: {
          fontFamily: string;
          fontSize?: number;
          color?: string;
          backgroundColor?: string;
          fontStyle?: 'normal' | 'italic';
          fontWeight?: 'normal' | 'bold';
          textAlign?: 'left' | 'center' | 'right' | 'justify';
          showHeading?: boolean;
          headingColor?: string;
     },
     testTableHeaderTextColor: string;
     mainReportHeaderColor: string;
     testTableHeaderFontSize: number;
     companyInfo: {
          namefontsize: number;
          color: string;
     };
     testBody: {
          fontSize: number;
          fontFamily: string;
          color: string;
          highlightFlags: boolean;
          hightFlagColor: string;
          hasColorsForFlags: boolean;
          lowFlagColor: string;
          boldenParameter: boolean;
          boldenValue: boolean;
          boldenUnits: boolean;
     };
     includeSignature: boolean;
     includeLimitations: boolean;
     limitations: string;
     showEndOfResult: boolean;
     template: number;
     includeBarcode?: boolean;
}



export interface OutsourcedTestTracking {
     id?: number;
     serviceid: number;
     testid: number;
     employeeid: number;
     status: number;
     comments: string;
     createdOn?: Date | string;
     updatedOn?: Date | string;
     outsourceid: number;
     completedconfirmedby?: number;
}


export interface ResultPrintingTracking {
     trackid?: number;
     ascensionid: number;
     employeeid: number;
     action: 'view' | 'printed';
     count?: number;
     actionon?: string;
}
