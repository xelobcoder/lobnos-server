import KnexConnection from '../../database/KnexConnections';
import InsuranceClass from '../insurance/Insurance';
import { CustomTest } from '../resultentry/customTestEntry';
import ClinicianClass from './clinicianClass';
import {
     EntityType,
     ApplicableTest,
     ApplicableEntity,
     BillingStrategyRequestBody,
     IBillingStrategy
} from './c.dev.type';
import { OperationsFailures } from '../operations/types';

export default class BillingStrategy {
     async entityExists(tenantId: number, entity_type: EntityType, entity_id: number): Promise<boolean> {
          const connection = await KnexConnection(tenantId);
          switch (entity_type) {
               case 'clinician':
                    const clinician = await new ClinicianClass().getSingleClinician(tenantId, entity_id);
                    return clinician.length > 0;
               case 'insurance':
                    return await new InsuranceClass(entity_id).checkInsuranceExistence(tenantId, entity_id);
               case 'organization':
                    const organization = await connection('organization').where({ id: entity_id }).first();
                    return !!organization;
               case 'general':
                    return true;
               default:
                    return false;
          }
     }


     async getEntityInfo(tenantId: number, entity_type: EntityType, entity_id: number): Promise<boolean> {
          const connection = await KnexConnection(tenantId);
          switch (entity_type) {
               case 'clinician':
                    const clinician = await new ClinicianClass().getSingleClinician(tenantId, entity_id);
                    return clinician
               case 'insurance':
                    return await new InsuranceClass(entity_id).getInsuranceById(tenantId, entity_id);
               case 'organization':
                    const organization = await connection('organization').where({ id: entity_id }).first();
                    return organization
               case 'general':
                    return true;
               default:
                    return false;
          }
     }



     async getEntityInfoWithId(
          tenantId: number,
          entity_type: EntityType,
          entity_id: number
     ): Promise<any> {
          const entityInfo = await this.getEntityInfo(tenantId, entity_type, entity_id);

          if (!entityInfo) {
               return null;
          }

          const formatEntity = (item: any) => {
               if (entity_type === 'clinician') {
                    return { id: item.id, name: item.name, entity_type: 'clinician' };
               }
               if (entity_type === 'insurance' || entity_type === 'phis') {
                    return { id: item.id, name: item.insuranceName, entity_type: 'insurance' };
               }
               if (entity_type === 'organization') {
                    return { id: item.id, name: item.name, entity_type: 'organization' };
               }
               return item; // fallback, in case none match
          };

          if (Array.isArray(entityInfo)) {
               return entityInfo.map(formatEntity);
          }

          return [formatEntity(entityInfo)];
     }


     private calculateDiscountedValue(
          originalPrice: number,
          concessionMode: 'absolute' | 'percentage',
          concessionValue: number,
          pricingType: 'discount' | 'surcharge'
     ): number {
          let discountedValue = concessionMode === 'absolute' ? concessionValue : (originalPrice * concessionValue) / 100;
          discountedValue = Math.max(0, discountedValue);
          const finalPrice = pricingType === 'discount' ? originalPrice - discountedValue : originalPrice + discountedValue;
          return Number((finalPrice < 0 ? (pricingType === 'discount' ? originalPrice : 0) : finalPrice).toFixed(2));
     }

     private async validateApplicableTest(
          tenantId: number,
          applicableTest: ApplicableTest[],
          allConcessionApplied: boolean
     ): Promise<ApplicableTest[] | null> {
          if (!allConcessionApplied && !Array.isArray(applicableTest)) {
               throw new TypeError("Expected 'applicableTest' to be an array.");
          }

          if (!allConcessionApplied && applicableTest.length > 0) {
               const connection = await KnexConnection(tenantId);
               const validTests = await connection('test_panels')
                    .select('id', 'price').whereIn('id', applicableTest.map(item => item.testid));
               const mapped = applicableTest.filter(item => {
                    const test = validTests.find((valid: { id: number }) => valid.id === item.testid);
                    if (
                         !test ||
                         !item.testid ||
                         typeof item.testid !== 'number' ||
                         item.concessionValue < 0 ||
                         item.concessionValue > 9999.99 ||
                         !['absolute', 'percentage'].includes(item.concessionMode) ||
                         !['discount', 'surcharge'].includes(item.pricingType)
                    ) {
                         return false;
                    }
                    const calculatedFinalPrice = this.calculateDiscountedValue(
                         item.originalPrice,
                         item.concessionMode,
                         item.concessionValue,
                         item.pricingType
                    );
                    return (
                         Math.abs(item.discountedValue - calculatedFinalPrice) < 0.01 &&
                         item.discountedValue <= 9999.99 &&
                         item.actualPrice >= 0 &&
                         item.originalPrice >= 0
                    );
               });
               return mapped.length > 0 ? mapped : null;
          }
          return null;
     }

     private async validateApplicableEntities(
          tenantId: number,
          applicableEntities: ApplicableEntity[]
     ): Promise<ApplicableEntity[] | null> {
          if (!Array.isArray(applicableEntities) || applicableEntities.length === 0) {
               return [{ entity_type: 'general', entity_id: 0 }];
          }

          const validEntities = await Promise.all(
               applicableEntities.map(async (entity) => {
                    const exists = await this.entityExists(tenantId, entity.entity_type, entity.entity_id);
                    return exists ? entity : null;
               })
          );
          const filtered = validEntities.filter((entity): entity is ApplicableEntity => entity !== null);

          return filtered.length > 0 ? filtered : null;
     }

     private async sanitizeClinicianBillingData(
          tenantId: number,
          data: BillingStrategyRequestBody
     ): Promise<IBillingStrategy & { applicableTest?: ApplicableTest[] } | string> {
          const {
               allConcessionApplied,
               concessionValue,
               concessionMode,
               price_type = 'discount',
               valid_from,
               valid_until,
               name,
               description,
               applicableTest
          } = data;

          if (!name || name.length > 100) {
               return 'Strategy name is required and must not exceed 100 characters.';
          }

          if (concessionValue < 0 || concessionValue > 9999.99) {
               return 'Concession value must be between 0 and 9999.99.';
          }


          let validatedApplicableTest: ApplicableTest[] | null = null;
          if (!allConcessionApplied && applicableTest && Array.isArray(applicableTest) && applicableTest.length > 0) {
               validatedApplicableTest = await this.validateApplicableTest(tenantId, applicableTest, allConcessionApplied);
               if (validatedApplicableTest === null) {
                    return 'No valid tests provided.';
               }
          }

          return {
               allConcessionApplied: allConcessionApplied ? 1 : 0,
               concessionValue,
               concessionMode,
               price_type,
               name,
               description: description || null,
               valid_from: valid_from || null,
               valid_until: valid_until || null,
               is_expired: valid_until ? new Date(valid_until) < new Date() : false,
               createdon: new Date().toISOString(),
               updatedon: null,
               strategyid: 0,
               applicableTest: validatedApplicableTest || []
          };
     }

     public async insertBillingStrategy(tenantId: number, requestBody: BillingStrategyRequestBody): Promise<number> {
          const connection = await KnexConnection(tenantId);
          try {
               const strategyId = await connection.transaction(async (trx) => {
                    const data = await this.sanitizeClinicianBillingData(tenantId, requestBody);
                    if (typeof data === 'string') throw new Error(data);

                    const insertResult = await trx('billingstrategy')
                         .insert({
                              name: data.name,
                              description: data.description,
                              allConcessionApplied: data.allConcessionApplied,
                              concessionValue: data.concessionValue,
                              concessionMode: data.concessionMode,
                              price_type: data.price_type,
                              valid_from: data.valid_from,
                              valid_until: data.valid_until,
                              is_expired: data.is_expired,
                              createdon: data.createdon,
                              updatedon: data.updatedon
                         })
                         .onConflict('name')
                         .merge({
                              description: data.description,
                              allConcessionApplied: data.allConcessionApplied,
                              concessionValue: data.concessionValue,
                              concessionMode: data.concessionMode,
                              price_type: data.price_type,
                              valid_from: data.valid_from,
                              valid_until: data.valid_until,
                              is_expired: data.is_expired,
                              updatedon: trx.fn.now()
                         });

                    const [insertedStrategyId] = insertResult;
                    if (!insertedStrategyId) {
                         throw new Error('Failed to insert or update billing strategy.');
                    }

                    if (data.allConcessionApplied === 0 && data.applicableTest?.length > 0) {
                         // 1. Prepare data
                         const values = data.applicableTest.map(test => [
                              insertedStrategyId,
                              test.testid,
                              test.concessionValue,
                              test.discountedValue,
                              test.concessionMode,
                              test.pricingType
                         ]);

                         // 2. UPSERT: Insert or update existing
                         await trx.raw(`
                         INSERT INTO billingstrategy_tests 
                         (strategyid, testid, concessionValue, discountedValue, concessionMode, pricingType)
                         VALUES ${values.map(() => '(?, ?, ?, ?, ?, ?)').join(',')}
                         ON DUPLICATE KEY UPDATE
                         concessionValue = VALUES(concessionValue),
                         discountedValue = VALUES(discountedValue),
                         concessionMode = VALUES(concessionMode),
                         pricingType = VALUES(pricingType)
                    `, values.flat());

                         // 3. DELETE: Remove tests no longer in the request
                         const requestTestIds = data.applicableTest.map(test => test.testid);
                         await trx('billingstrategy_tests')
                              .where({ strategyid: insertedStrategyId })
                              .whereNotIn('testid', requestTestIds)
                              .del();
                    } else {
                         // If allConcessionApplied is 1, clear old tests
                         await trx('billingstrategy_tests')
                              .where({ strategyid: insertedStrategyId })
                              .del();
                    }

                    return insertedStrategyId;
               });

               return parseInt(strategyId.toString());
          } catch (error) {
               throw new Error(`Failed to insert billing strategy: ${error.message}`);
          }
     }


     public async addApplicableTests(
          tenantId: number,
          strategyid: number,
          applicableTest: ApplicableTest[]
     ): Promise<boolean> {
          const connection = await KnexConnection(tenantId);
          try {
               const strategy = await connection('billingstrategy').where({ strategyid }).first();
               if (!strategy) {
                    throw new Error('Billing strategy not found.');
               }
               if (strategy.allConcessionApplied === 1) {
                    throw new Error('Cannot add applicable tests to a strategy with allConcessionApplied enabled.');
               }

               const validatedApplicableTest = await this.validateApplicableTest(tenantId, applicableTest, false);
               if (validatedApplicableTest === null) {
                    throw new Error(OperationsFailures.applicableTestNotFound + ' or invalid content of applicable Test');
               }

               await connection.transaction(async (trx) => {
                    await trx('billingstrategy_tests').where({ strategyid }).del();
                    await trx('billingstrategy_tests').insert(
                         validatedApplicableTest.map(test => ({
                              strategyid,
                              testid: test.testid,
                              concessionValue: test.concessionValue,
                              discountedValue: test.discountedValue,
                              concessionMode: test.concessionMode,
                              pricingType: test.pricingType
                         }))
                    );
               });
               return true;
          } catch (error) {
               console.error(error);
               throw new Error(`Failed to add applicable tests: ${error.message}`);
          }
     }

     public async addCategoryToStrategy(
          tenantId: number,
          strategyid: number,
          category: EntityType,
          associatedid: number
     ): Promise<boolean> {
          const connection = await KnexConnection(tenantId);
          try {
               const strategy = await connection('billingstrategy').where({ strategyid }).first();
               if (!strategy) {
                    throw new Error('Billing strategy not found.');
               }

               const entity_type: EntityType = category === 'phis' ? 'insurance' : category;
               if (!['clinician', 'insurance', 'organization', 'general'].includes(entity_type)) {
                    throw new Error(`Invalid entity type: ${entity_type}`);
               }

               const exists = await this.entityExists(tenantId, entity_type, associatedid);
               if (!exists) {
                    throw new Error(`Entity of type ${entity_type} with ID ${associatedid} does not exist.`);
               }

               const existingMapping = await connection('billingstrategy_mapping')
                    .where({ strategyid, entity_type, entity_id: associatedid })
                    .first();

               //      if (existingMapping) {
               //      throw new Error(`Mapping for strategy ${strategyid} to ${entity_type} ID ${associatedid} already exists.`);
               // }

               await connection('billingstrategy_mapping').insert({
                    strategyid,
                    entity_type,
                    entity_id: associatedid
               }).onConflict(['strategyid', 'entity_type', 'entity_id']).merge({
                    entity_type,
                    entity_id: associatedid
               });
               return true;
          } catch (error) {
               console.error(error);
               throw new Error(`Failed to add category to strategy: ${error.message}`);
          }
     }

     private async sanitizeToFieldsOfStrategy(strategyid: number, tenantId: number): Promise<IBillingStrategy & { applicableTest: ApplicableTest[], applicableEntities: ApplicableEntity[] }> {
          const connection = await KnexConnection(tenantId);
          const strategy = await connection('billingstrategy').where({ strategyid }).first();
          if (!strategy) {
               throw new Error('Billing strategy not found.');
          }

          const applicableTest = await connection('billingstrategy_tests as bst')
               .leftJoin('test_panels as tp', 'bst.testid', 'tp.id')
               .leftJoin('testdetails', 'tp.id', 'testdetails.testid')
               .select(
                    'bst.testid',
                    'bst.concessionValue',
                    'bst.discountedValue',
                    'bst.concessionMode',
                    'bst.pricingType',
                    'tp.price as actualPrice',
                    'tp.price as originalPrice',
                    'tp.name',
                    'testdetails.isoutsourced'
               )
               .where({ 'bst.strategyid': strategyid });



          let applicableEntities = await connection('billingstrategy_mapping')
               .leftJoin('billingstrategy', 'billingstrategy_mapping.strategyid', 'billingstrategy.strategyid')
               .select('billingstrategy_mapping.entity_type', 'billingstrategy_mapping.entity_id')
               .where({ 'billingstrategy.strategyid': strategyid });

          if (Array.isArray(applicableEntities) && applicableEntities.length > 0) {
               const entityPromises = applicableEntities.map(async (entity) => {

                    const information = await this.getEntityInfo(tenantId, entity.entity_type, entity.entity_id);

                    if (information && Array.isArray(information) && information.length > 0) {
                         return { entity_type: entity.entity_type, ...information[0] }
                    }

                    if (information && typeof information === "object" && Object.keys(information).length > 0) {
                         return { entity_type: entity.entity_type, ...information as Object };
                    }
                    return null;
               });

               applicableEntities = await Promise.all(entityPromises)
                    .then(results => results.filter(result => result !== null));
          }


          return {
               ...strategy,
               description: strategy.description || null,
               valid_from: strategy.valid_from || null,
               valid_until: strategy.valid_until || null,
               applicableTest: applicableTest.map(test => ({
                    testid: test.testid,
                    concessionValue: test.concessionValue,
                    discountedValue: test.discountedValue,
                    concessionMode: test.concessionMode,
                    pricingType: test.pricingType,
                    actualPrice: test.actualPrice || 0,
                    name: test.name,
                    originalPrice: test.originalPrice || 0
               })),
               applicableEntities
          };
     }

     public async getBillingStrategy(tenantId: number, strategyid: number) {
          try {
               const strategy = await this.sanitizeToFieldsOfStrategy(strategyid, tenantId);
               return strategy || null;
          } catch (error) {
               return null;
          }
     }

     public async updateBillingStrategy(
          tenantId: number,
          strategyid: number,
          updates: Partial<IBillingStrategy>
     ): Promise<string> {
          try {
               const connection = await KnexConnection(tenantId);
               const updated = await connection('billingstrategy')
                    .where({ strategy_id: strategyid })
                    .update({
                         ...updates,
                         is_expired: updates.valid_until ? new Date(updates.valid_until) < new Date() : false,
                         updated_on: connection.fn.now(),
                    });
               return updated > 0 ? 'updated successfully' : 'no update occurred';
          } catch (error: any) {
               return error.message || 'unknown error occurred';
          }
     }

     public async deleteBillingStrategy(tenantId: number, strategyid: number): Promise<boolean> {
          const connection = await KnexConnection(tenantId);
          try {
               await connection.transaction(async (trx) => {
                    await trx('billingstrategy_tests').where({ strategyid }).del();
                    await trx('billingstrategy_mapping').where({ strategyid }).del();
                    await trx('billingstrategy').where({ strategyid }).del();
               });
               return true;
          } catch (error) {
               console.error(error);
               throw new Error(`Failed to delete billing strategy: ${error.message}`);
          }
     }

     public async getAllBillingStrategies(tenantId: number): Promise<(IBillingStrategy & { applicableTest: ApplicableTest[], applicableEntities: ApplicableEntity[] })[]> {
          const connection = await KnexConnection(tenantId);
          const strategies = await connection('billingstrategy').select('*');
          return Promise.all(strategies.map(strategy => this.sanitizeToFieldsOfStrategy(strategy.strategyid, tenantId)));
     }

     public async getAllBillingStrategiesWithoutApplicableTest(tenantId: number, count: number = 10, page: number = 1): Promise<(IBillingStrategy & { applicableTest: ApplicableTest[], applicableEntities: ApplicableEntity[] })[]> {
          const connection = await KnexConnection(tenantId);
          const strategies = await connection('billingstrategy')
               .select('*').limit(count).offset((page - 1) * count);
          return strategies;
     }

     public async getBillingStrategyByEntity(
          tenantId: number,
          entity_type: EntityType,
          entity_id: number,
     ): Promise<(IBillingStrategy & { applicableTest: ApplicableTest[], applicableEntities: ApplicableEntity[] })[]> {
          if (!entity_type || !entity_id) {
               throw new Error('Entity type and ID are required.');
          }
          const connection = await KnexConnection(tenantId);

          const query = connection('billingstrategy_mapping as m')
               .join('billingstrategy as s', 's.strategyid', 'm.strategyid')
               .whereRaw(`
                    m.entity_type = ?
                    AND m.entity_id = ?
                    AND (s.valid_from IS NULL OR s.valid_from <= CURRENT_TIMESTAMP)
                    AND (s.valid_until IS NULL OR s.valid_until >= CURRENT_TIMESTAMP)
               `, [entity_type, entity_id]);

          const strategies = await query.select('s.*');

          if (strategies.length === 0) {
               return [];
          }

          return Promise.all(strategies.map(strategy => this.sanitizeToFieldsOfStrategy(strategy.strategyid, tenantId)));
     }

     public async entityHasStrategy(tenantId: number, entity_type: EntityType, entity_id: number): Promise<boolean> {
          const connection = await KnexConnection(tenantId);
          const exists = await connection('billingstrategy_mapping')
               .where({ entity_type, entity_id })
               .first();
          return !!exists;
     }

     private async loadAllTests(tenantId: number) {
          return await new CustomTest(null, null).loadTestWithDetails(tenantId);
     }

     // Helper to map tests with default pricing
     private mapTestsWithDefaults(tests: any[]) {
          return tests.map(({ price, name, testid, id, isoutsourced }) => ({
               discountedValue: price,
               price,
               name,
               id,
               isoutsourced,
               testid,
               concessionMode: 'absolute',
               concessionValue: 0,
               pricingType: 'discount',
               actualPrice: price,
               originalPrice: price
          }));
     }


     public async getProvidentialBillingHandler(
          tenantId: number,
          entity_type: EntityType,
          associatedid: number,
          fallbackToDefault: boolean
     ): Promise<any> {
          try {
               if (!entity_type) {
                    throw new Error('Entity type required.');
               }
               if (entity_type !== "general" && !associatedid) {
                    throw new Error('Associated ID is required for non-general entities.');
               }
               if (entity_type === "general") {
                    return this.mapTestsWithDefaults(await this.loadAllTests(tenantId));
               }

               const strategyList = await this.getBillingStrategyByEntity(tenantId, entity_type, associatedid);

               if (!strategyList.length && !fallbackToDefault) {
                    return `${OperationsFailures.billingStrategyNotFoundForEntity} or ${OperationsFailures.billingStrategyExpired}`;
               }

               const allTest = await this.loadAllTests(tenantId);
               const testMap = new Map(allTest.map(test => [test.testid, test]));

               // No strategy, fallback to default prices
               if (!strategyList.length && fallbackToDefault) {
                    return this.mapTestsWithDefaults(allTest);
               }

               const {
                    concessionMode,
                    concessionValue,
                    allConcessionApplied,
                    applicableTest,
                    price_type
               } = strategyList[0];

               const isTruthy = (val: number) => val === 1;



               // CASE 1: All concession applies
               if (isTruthy(allConcessionApplied) && allTest.length) {
                    return allTest.map(({ price, name, testid, id }) => ({
                         discountedValue: this.calculateDiscountedValue(price, concessionMode, concessionValue, price_type),
                         price,
                         name,
                         id,
                         testid,
                         concessionMode,
                         concessionValue,
                         actualPrice: price,
                         originalPrice: price
                    }));
               }

               // CASE 2: Specific applicable tests
               if (applicableTest && Array.isArray(applicableTest) && applicableTest.length > 0) {
                    const applicableTestIds = applicableTest.map(test => test.testid);

                    const formattedApplicableTest = applicableTest.map(test => {
                         const matched = testMap.get(test.testid) as {
                              price: number;
                              name: string;
                              id: number;
                              isoutsourced?: boolean;
                         } | undefined;
                         if (!matched) return null;

                         return {
                              discountedValue: this.calculateDiscountedValue(
                                   test.originalPrice,
                                   test.concessionMode,
                                   test.concessionValue,
                                   test.pricingType
                              ),
                              price: matched.price,
                              name: matched.name,
                              id: matched.id,
                              testid: test.testid,
                              concessionMode: test.concessionMode,
                              concessionValue: test.concessionValue,
                              actualPrice: test.originalPrice,
                              isoutsourced: matched.isoutsourced ?? false,
                              originalPrice: test.originalPrice,
                              pricingType: test.pricingType
                         };
                    }).filter(Boolean);

                    const remainingTests = allTest
                         .filter(test => !applicableTestIds.includes(test.testid))
                         .map(({ price, name, testid, id }) => ({
                              discountedValue: price,
                              price,
                              name,
                              id,
                              testid,
                              concessionMode: 'absolute',
                              concessionValue: 0,
                              pricingType: 'discount',
                              actualPrice: price,
                              originalPrice: price
                         }));

                    return [...formattedApplicableTest, ...remainingTests];
               }


          } catch (error) {
               console.error('Error in getProvidentialBillingHandler:', error);
               throw new Error('Internal server error.');
          }
     }


     public static async getStrategyBulkBillingData(tenantId: number, entity_type: EntityType, entity_id: number): Promise<any[]> {
          try {
               if (!entity_type || !entity_id) {
                    throw new Error('Entity type and ID are required.');
               }

               const strategyList = await new BillingStrategy().getBillingStrategyByEntity(tenantId, entity_type, entity_id);
               if (strategyList.length === 0) return [];

               const { concessionMode, concessionValue, allConcessionApplied, applicableTest } = strategyList[0];
               const isTruthy = (value: number) => value === 1;
               const allTest = await new CustomTest(null, null).loadTestWithDetails(tenantId);

               if (isTruthy(allConcessionApplied) && allTest.length) {
                    const billingTestList = await Promise.all(
                         allTest.map(async ({ price, name, testid, id }) => {
                              const discountedValue = new BillingStrategy().calculateDiscountedValue(
                                   price,
                                   concessionMode,
                                   concessionValue,
                                   strategyList[0].price_type
                              );
                              return {
                                   discountedValue,
                                   price,
                                   name,
                                   id,
                                   testid,
                                   concessionMode,
                                   actualPrice: price,
                                   originalPrice: price,
                                   concessionValue
                              };
                         })
                    );
                    return billingTestList;
               }

               if (applicableTest && applicableTest.length > 0) {
                    const reformattedTest = allTest.map(({ price, name, testid }) => ({
                         discountedValue: price,
                         name,
                         testid,
                         id: testid,
                         concessionValue: 0,
                         concessionMode: 'absolute',
                         pricingType: 'discount',
                         actualPrice: price,
                         originalPrice: price
                    }));

                    const formattedApplicableTest = applicableTest
                         .map(({ testid, concessionMode, concessionValue, pricingType, actualPrice, originalPrice }) => {
                              const matchedItem = allTest.find((field) => field.testid === testid);
                              if (matchedItem) {
                                   const { price, name, id } = matchedItem;
                                   const discountedValue = new BillingStrategy().calculateDiscountedValue(
                                        originalPrice,
                                        concessionMode,
                                        concessionValue,
                                        pricingType
                                   );
                                   return {
                                        discountedValue,
                                        price,
                                        name,
                                        id,
                                        testid,
                                        concessionMode,
                                        concessionValue,
                                        actualPrice,
                                        originalPrice,
                                        pricingType
                                   };
                              }
                              return null;
                         })
                         .filter((item) => item !== null);

                    const mergedTests = [
                         ...formattedApplicableTest,
                         ...reformattedTest.filter(
                              (reformattedItem) => !formattedApplicableTest.some((formattedItem) => formattedItem.testid === reformattedItem.testid)
                         )
                    ];

                    return mergedTests;
               }

               return [];
          } catch (error) {
               console.error('Error in getStrategyBulkBillingData:', error);
               throw new Error('Internal server error.');
          }
     }

     public async getStrategySingleTestValue(
          tenantId: number,
          entity_type: EntityType,
          entity_id: number,
          testid: number
     ): Promise<{ testid: number, price: number, discountedValue: number, actualPrice: number, originalPrice: number } | null> {
          try {
               const strategyData = await this.getBillingStrategyByEntity(tenantId, entity_type, entity_id);
               if (!strategyData || strategyData.length === 0) {
                    throw new Error('Billing strategy not found.');
               }

               const { applicableTest, concessionMode, concessionValue, allConcessionApplied } = strategyData[0];
               const connection = await KnexConnection(tenantId);
               const test = await connection('test_panels')
                    .select('id', 'price')
                    .where('test_panels.id', testid)
                    .first();

               if (!test) {
                    return null;
               }

               const { price } = test;

               if (allConcessionApplied === 1) {
                    const discountedValue = this.calculateDiscountedValue(
                         price,
                         concessionMode,
                         concessionValue,
                         strategyData[0].price_type
                    );
                    return { testid, price, discountedValue, actualPrice: price, originalPrice: price };
               }

               if (Array.isArray(applicableTest) && applicableTest.length > 0) {
                    const applicableTestData = applicableTest.find((test: { testid: number }) => +test.testid === +testid);
                    if (applicableTestData) {
                         const { concessionMode, concessionValue, pricingType, actualPrice, originalPrice } = applicableTestData;
                         const discountedValue = this.calculateDiscountedValue(
                              originalPrice,
                              concessionMode,
                              concessionValue,
                              pricingType
                         );
                         return { testid, price, discountedValue, actualPrice, originalPrice };
                    } else {
                         return { testid, price, discountedValue: price, actualPrice: price, originalPrice: price };
                    }
               }

               return null;
          } catch (error) {
               console.error('Error in getStrategySingleTestValue:', error);
               throw new Error('Internal server error.');
          }
     }

     public async deleteStrategyApplicableEntities(
          tenantId: number,
          strategyId: number,
          entityId: number,
          entityType: EntityType
     ): Promise<boolean> {
          try {
               const connection = await KnexConnection(tenantId);
               const strategy = await connection('billingstrategy_mapping')
                    .where({ strategyid: strategyId, entity_id: entityId, entity_type: entityType }).del();
               return strategy > 0;
          } catch (error) {
               console.error('Error in deleteStrategyApplicableEntities:', error);
               throw new Error('Internal server error.');
          }
     }

     public async getProvidentialTestPrice(
          tenantId: number,
          entityType: EntityType,
          entityId: number,
          testId: number,
          fallbackToDefault: boolean,
          trx: any = null
     ): Promise<number> {
          // Helper to get the default price from test_panels
          const getDefaultPrice = async (): Promise<number> => {
               const connection = trx || await KnexConnection(tenantId);
               const test = await connection('test_panels').where({ id: testId }).first();
               if (!test) throw new Error("Test not found");
               return test.price;
          };

          if (entityType === "general") {
               return getDefaultPrice();
          }

          const strategies = await this.getBillingStrategyByEntity(tenantId, entityType, entityId);
          if (!strategies || strategies.length === 0) {
               if (fallbackToDefault) {
                    return getDefaultPrice();
               }
               throw new Error("No billing strategy found for entity and fallbackToDefault is false");
          }

          const strategy = strategies[0];
          let concessionMode = strategy.concessionMode || "absolute";
          let concessionValue = strategy.concessionValue ?? 0;
          let pricingType = strategy.price_type || "discount";
          const isAllConcession = strategy.allConcessionApplied === 1;

          const connection = await KnexConnection(tenantId);
          const test = await connection('test_panels').where({ id: testId }).first();
          if (!test) throw new Error("Test not found");
          const basePrice = test.price;

          if (isAllConcession) {
               const discounted = this.calculateDiscountedValue(basePrice, concessionMode, concessionValue, pricingType);
               return discounted;
          }

          // Check for test-specific mapping
          if (Array.isArray(strategy.applicableTest)) {
               for (const t of strategy.applicableTest) {
                    if (t.testid === testId) {
                         const discounted = this.calculateDiscountedValue(basePrice, t.concessionMode, t.concessionValue, t.pricingType);
                         return discounted;
                    }
               }
          }

          return basePrice;
     }

}
