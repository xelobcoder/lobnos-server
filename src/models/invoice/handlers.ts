import logger from "../../hooks/logger";
import { testInformationQuery, clientInformationQuery } from "./queries";
import { promisifyQuery } from "../../hooks/helper";

export const testInformation = async (tenantId:number,billingid: string | number): Promise<any[]> => {
  try {
    return await promisifyQuery(tenantId,testInformationQuery, [billingid]);
  } catch (err) {
    logger.error(err);
    throw new Error(err);
  }
};

export const clientInformation = async (tenantId:number,billingid: string | number): Promise<any[]> => {
  try {
    return await promisifyQuery(tenantId,clientInformationQuery, [billingid]);
  } catch (err) {
    logger.error(err);
    throw new Error(err);
  }
};
