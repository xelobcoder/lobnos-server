export const enum concesMode {
    percentage = "percentage",
    absolute = "absolute",
    none = "none"
}

type testArrayType = {
    concessionMode: string,
    concessionValue: number | string,
    price: number
}

type priceType =  'discount' | 'surcharge'
export type createRule = {
    organizationid: number;
    useCustomLetterHeadings: boolean,
    hasConcessionAppliedAcross: boolean,
    concessionMode: concesMode,
    concessionValue: number,
    priceType:priceType,
    employeeid: number,
    haveDifferentPriceList: boolean,
    testList: testArrayType[] | { discountedValue: number, id: number }[]
}