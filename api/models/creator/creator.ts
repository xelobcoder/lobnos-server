import { Response } from "express";
import { promisifyQuery, rowAffected, responseError } from "../../../helper";
import testpanel from "../../testpanel/list";
import { _comments_query, getGenderQuery, testCreationRule, update_creation_query } from "./queries";
interface CreationRule {
  name: string;
  value?: string;
  hasGenderVariation?: boolean;
  male?: { upperlimit: number; lowerlimit: number };
  female?: { upperlimit: number; lowerlimit: number };
  upperlimit?: number;
  lowerlimit?: number;
  [key: string]: any;
}

class Creator {
  testid: string;

  constructor(testid: string) {
    this.testid = testid;
  }

  async getTestCreationRule() {
    if (!this.testid) throw new Error("testid is required");
    const rule = await promisifyQuery(testCreationRule, [this.testid]);
    if (rule.length > 0 && rule[0].creationrule !== "{}") {
      const result = JSON.parse(rule[0].creationrule) as CreationRule[];
      return result;
    }
    return [];
  }

  

  async getPreviousRecords(testname: string, billingid: string, patientid: string) {
    const tablename = `result${testpanel.generateTableName(testname)}`;
    const previousRecords = await promisifyQuery(`SELECT * FROM ${tablename} WHERE billingid = ? AND patientid = ?`, [
      billingid,
      patientid,
    ]);
    return previousRecords;
  }




  async getCustomPreviousRecords(testname: string, billingid: string, patientid: string) {
    try {
      const previousRecords = await this.getPreviousRecords(testname, billingid, patientid);
      if (previousRecords.length > 0 && previousRecords.some((item) => item.field === "ultrasound")) {
        return previousRecords[0];
      }

      let result = await this.getTestCreationRule();

      const hasGenderVariation = result.length > 0 && result.some((item) => item.hasGenderVariation === true);

      let clientGender = "";

      if (hasGenderVariation) {
        const packet = await promisifyQuery(getGenderQuery, [patientid]);
        if (packet.length > 0) clientGender = packet[0]["gender"];
      }

      if (previousRecords.length === 0) return result;

      result = result.map((item) => {
        const { name } = item;
        const matched = previousRecords.find((u) => u.field === name);
        return matched ? { ...item, value: matched.value } : item;
      });

      if (hasGenderVariation && clientGender) {
        result = result.map((item) => {
          const obj: any = { ...item };
          if (item[clientGender]) {
            obj.upperlimit = item[clientGender].upperlimit;
            obj.lowerlimit = item[clientGender].lowerlimit;
            delete obj.female;
            delete obj.male;
          }
          return obj;
        });
      }
      return result;
    } catch (err) {
      responseError(Response);
    }
  }



  async getCustomCommentsRecords(billingid: string, testid: string) {
    if (!billingid || !testid) {
      throw new Error("testid and billingid required");
    }
    let comments = await promisifyQuery(_comments_query, [billingid, testid]);
    return comments.length > 0 ? comments[0]["comments"] : "";
  }



  async updateTestCreationRule(data: CreationRule[]) {
    if (!this.testid || !data) throw new Error("testid and data is required");
    const stringdata = JSON.stringify(data);
    const isUpdated = await promisifyQuery(update_creation_query, [stringdata, this.testid]);
    return rowAffected(isUpdated);
  }


}

export default Creator;
