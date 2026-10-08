import { Request, Response, NextFunction } from "express";
import { configuration } from "../hooks/configuration";
import logger from "../hooks/logger";

export const MASTER_TEST_LINK_COLUMN = 'master_testid';

const linkColumnReady = new WeakMap<object, Promise<boolean>>();

/**
 * Makes sure tenant `test_panels` can remember which master catalog test a panel was imported from.
 * Returns false (and leaves imports working as before) when the column cannot be checked or created.
 */
export function ensureMasterTestLinkColumn(connection: any): Promise<boolean> {
     if (!connection?.schema?.hasColumn) return Promise.resolve(false);
     let ready = linkColumnReady.get(connection);
     if (!ready) {
          ready = (async () => {
               try {
                    if (await connection.schema.hasColumn('test_panels', MASTER_TEST_LINK_COLUMN)) return true;
                    await connection.schema.alterTable('test_panels', (table: any) => {
                         table.integer(MASTER_TEST_LINK_COLUMN).nullable().index('idx_test_panels_master_testid');
                    });
                    logger.info(`[MasterCatalog] Added test_panels.${MASTER_TEST_LINK_COLUMN}`);
                    return true;
               } catch (error) {
                    logger.error('[MasterCatalog] Unable to ensure test_panels.master_testid:', error);
                    linkColumnReady.delete(connection);
                    return false;
               }
          })();
          linkColumnReady.set(connection, ready);
     }
     return ready;
}

/**
 * When ENFORCE_MASTER_TEST_CATALOG=true, tenants may only add tests by importing them from the
 * master catalog in primelabmaster_control; ad-hoc test creation is rejected.
 */
export const blockWhenMasterCatalogEnforced = (_req: Request, res: Response, next: NextFunction) => {
     if (!configuration.enforceMasterTestCatalog) return next();
     return res.status(403).json({
          status: 'error',
          statusCode: 403,
          code: 'MASTER_CATALOG_ENFORCED',
          message: 'New tests must be imported from the master test catalog. Custom test creation is disabled.',
     });
};
