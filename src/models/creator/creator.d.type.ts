import { PrimeLimsTabletest_panels, PrimeLimsTabletestdetailcategory } from "../../database/DatabaseTableSchema";
import { TestDetailCategoryType } from "../operations/testFieldsCategoryClass";

type drugsType = {
     name?: string,
     drug?: string,
     id: number,
     reaction?: string,
     sensitivity?: string,
     categoryName?: string,
     categoryId?: number
}
type resultEntryType = {
     csvid: string, ptid: string,
     testid: number,
     fields: [],
     employeeid: number,
     comments: string,
     ascensionid: number,
     isScan: boolean,
     hasDrugs: boolean, drugs: drugsType[]
}
export interface CreationRule {
     name: string;
     value?: string;
     hasGenderVariation?: boolean;
     male?: { upperlimit: number; lowerlimit: number };
     female?: { upperlimit: number; lowerlimit: number };
     upperlimit?: number;
     lowerlimit?: number;
     [key: string]: any;
}


export type resultEntryTemplateView = {
     result: CreationRule[] | estCreationRule[] | [];
     testname: string;
     hasDrugs: boolean;
     testInfo: PrimeLimsTabletest_panels | null;
     testdetailcategory?: TestDetailCategoryType[] | null;
}

export type previewReportView = {
     result: Omit<CreationRule, 'male' | 'female' | 'type' | 'field' | 'usePlain' | 'isValueTracked' | 'alert' | 'valueAlert' | 'constraint' | 'alert'>[],
     testname: string;
     hasDrugs: boolean,
          testInfo: PrimeLimsTabletest_panels | null;
     testdetailcategory?: TestDetailCategoryType[] | null;
}
