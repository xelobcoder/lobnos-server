import { Packages } from "../packages/Billlingpackages";
import { BillingTestItem } from "./billingTypes";
import { PrimeBillingEnterprise } from "./PrimeBillingEnterprise";

export class PackageBillingHelper extends PrimeBillingEnterprise {
     static async getFormattedPackageTestList({
          tenantId,
          packageid,
     }: {
          tenantId: number;
          packageid: number;
     }): Promise<BillingTestItem[] | null> {
          const isPackageValid = await Packages.verifyPackageId(tenantId, packageid);
          if (!isPackageValid) return null;
          const allPackageTests = await Packages.getPackageTests(tenantId, packageid);
          if (!Array.isArray(allPackageTests) || allPackageTests.length === 0) return null;

          let reformttedPackage = allPackageTests.map((_package, index) => {
               const discountedValue = PrimeBillingEnterprise.calculatePackageConcessionDiscountedValue(_package.price, _package.concession_mode, _package.concession_value);
               return {
                    ..._package,
                    discountedValue,
                    discount: _package.discount || 0,
                    testid: _package.test_id
               };
          })

          reformttedPackage = reformttedPackage.map(item => ({
               ...item,
               hasNightAdjustment: false,
               isNightTime: false,
               amountIncurredDueTax: 0,
               totalcost: item.discountedValue,
               totalpayable: item.discountedValue,
               cost: item.discountedValue,
          }));
          return reformttedPackage
     }


     static calculateBillingTotals({
          usedPackage,
          recalculatedPackageList,
          recalculatedCart,
          recalculatedServicesList
     }: {
          usedPackage: boolean;
          recalculatedPackageList: any[];
          recalculatedCart: any[];
          recalculatedServicesList: any[];
     }): {
          subtotal: number;
          totaldiscount: number;
          totalAmountIncurredDueTax: number;
          totalServiceAmount: number;
          totalpayable: number;
     } {
          let subtotal = 0, totaldiscount = 0, totalAmountIncurredDueTax = 0, totalServiceAmount = 0;
          if (usedPackage) {
               recalculatedPackageList.forEach(item => {
                    subtotal += item.discountedValue;
                    totaldiscount += item.discount || 0;
               });
          } else {
               recalculatedCart.forEach(item => {
                    subtotal += item.discountedValue || item.servicePrice || 0;
                    totaldiscount += item.discount || 0;
                    totalAmountIncurredDueTax += item.amountIncurredDueTax || 0;
               });
          }
          if (recalculatedServicesList && Array.isArray(recalculatedServicesList)) {
               recalculatedServicesList.forEach(item => {
                    subtotal += item.discountedValue || item.servicePrice || 0;
                    totaldiscount += item.discount || 0;
                    totalAmountIncurredDueTax += item.amountIncurredDueTax || 0;
                    totalServiceAmount += item.discountedValue || item.price || item.servicePrice || 0;
               });
          }
          return { subtotal, totaldiscount, totalAmountIncurredDueTax, totalServiceAmount, totalpayable: subtotal };
     }

     static async handlePackageCheckout({
          tenantId,
          packageid,
     }: {
          tenantId: number;
          packageid: number;
     }): Promise<any> {
          const reformattedTest = await PackageBillingHelper.getFormattedPackageTestList({
               tenantId,
               packageid,
          });
          if (!reformattedTest || !Array.isArray(reformattedTest)) return { error: 'INVALID_PACKAGE_PROVIDED' };
          return { success: true, recalculatedPackageList: reformattedTest };
     }

     static async handlePackageInit({
          tenantId,
          packageid,
          patientId,
          billingid,
          defaultCustomerInitData,
          getConstantCustomerInitData
     }: {
          tenantId: number;
          packageid: number;
          patientId: number;
          billingid: number | undefined;
          defaultCustomerInitData: any;
          getConstantCustomerInitData: (patientId: number, billingid: number | undefined) => Promise<any>;
     }): Promise<any> {
          const reformattedTest = await PackageBillingHelper.getFormattedPackageTestList({
               tenantId,
               packageid,
          });
          if (!reformattedTest) return { error: 'INVALID_PACKAGE_PROVIDED' };
          const constants = await getConstantCustomerInitData(patientId, billingid);


          
          return {
               ...defaultCustomerInitData,
               ...constants,
               packageid: packageid,
               isPackageUsed: true,
               testList: reformattedTest,
               taxValue: 0,
               hasNightAdjustment: false,
               nightAdjustmentValue: 0,
               nightAdjustmentMode: 'none',
               promoCode: null,
               taxIncluded: false,
               taxList: null
          };
     }
}
