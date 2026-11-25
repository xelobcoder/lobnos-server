import { PrimeLimsTabletest_panels, PrimeLimsTabletestdetailcategory } from "../../interfaces/database";
import { TestDetailCategoryType } from "../operations/testFieldsCategoryClass";
import { TestCreationRule } from "../TestCreation/TestCreationRulesRepository";

export type drugsType = {
     name?: string,
     drug?: string,
     id: number,
     reaction?: string,
     sensitivity?: string,
     categoryName?: string,
     categoryId?: number
}
export type resultEntryType = {
     request_id?: string,
     expected_revision?: number,
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
     result: CreationRule[] | TestCreationRule[]| [];
     testname: string | null;
     hasDrugs: boolean;
     testInfo: PrimeLimsTabletest_panels | null;
     testdetailcategory?: TestDetailCategoryType[] | null;
}

export type previewReportView = {
     result: Omit<CreationRule, 'male' | 'female' | 'type' | 'field' | 'usePlain' | 'isValueTracked' | 'alert' | 'valueAlert' | 'constraint' | 'alert'>[],
     testname: string | null;
     hasDrugs: boolean,
          testInfo: PrimeLimsTabletest_panels | null;
     testdetailcategory?: TestDetailCategoryType[] | null;
}
