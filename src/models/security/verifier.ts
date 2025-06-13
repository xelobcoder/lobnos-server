import Security from "./securityClass";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
export type ResultField = {
     id: number;
     field?: string;
     billingid?: number;
     patientid?: number;
     value: string;
     created_on?: Date | string;
     updatedon?: Date | string;
     employeeid?: number;
     entrymode?: string;
}

export default class SecurityVerify extends Security {
     constructor(employeeid: number, loginDuration: number) {
          super(employeeid, loginDuration);
     }

     static async encryptResultStored(result: Partial<ResultField>) {
          try {
               const { value } = result;
               if (!value || (typeof value != "string" && typeof value != "number"))
               {
                    throw new Error("value not included in the result set");
               }

               const encrptedValue = await bcrypt.hash(value, 10);

               console.log(encrptedValue);
          } catch (err) {
               console.log(err)
          }
     }
}



