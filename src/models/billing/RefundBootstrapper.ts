import KnexConnection from '../../database/KnexConnections';
import logger from '../../hooks/logger';

export async function bootstrapRefundTableSanitization(tenantId = 1, strict = false): Promise<void> {
     try {
          const connection = await KnexConnection(tenantId);
          if (await connection.schema.hasTable('dbobillingrefundtable')) {
               const hasSecondWitness = await connection.schema.hasColumn('dbobillingrefundtable', 'secondWitness');
               const hasThirdWitness = await connection.schema.hasColumn('dbobillingrefundtable', 'thirdWitness');

               if (hasSecondWitness || hasThirdWitness) {
                    await connection.raw(`
					UPDATE dbobillingrefundtable
					SET firstWitness = COALESCE(
						NULLIF(firstWitness, 0),
						NULLIF(initiatedBy, 0),
						${hasSecondWitness ? 'NULLIF(secondWitness, 0),' : ''}
						${hasThirdWitness ? 'NULLIF(thirdWitness, 0),' : ''}
						0
					)
					WHERE (firstWitness = 0 OR firstWitness IS NULL)
				`);

                    const columnsToDrop = [
                         'secondWitness',
                         'secondWitnessDate',
                         'secondWitnessPurpose',
                         'thirdWitness',
                         'thirdWitnessDate',
                         'thirdWitnessPurpose'
                    ];

                    for (const col of columnsToDrop) {
                         if (await connection.schema.hasColumn('dbobillingrefundtable', col)) {
                              await connection.schema.alterTable('dbobillingrefundtable', (table) => {
                                   table.dropColumn(col);
                              });
                              logger.info(`[Bootstrap] Dropped redundant column dbobillingrefundtable.${col}`);
                         }
                    }
               }
          }
     } catch (error) {
          if (strict) throw error;
          logger.error('[Bootstrap] Failed to sanitize and drop redundant witness columns from dbobillingrefundtable:', error);
     }
}
