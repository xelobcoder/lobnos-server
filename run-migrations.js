import * as knex from 'knex';
import * as knexfile from './knexfile';

async function runMigrations() {
     const config = (knexfile as any).development;
     const db = knex.default(config);

     try {
          console.log('Running migrations...');
          await db.migrate.latest();
          console.log('Migrations completed successfully!');
     } catch (error) {
          console.error('Migration failed:', error);
          process.exit(1);
     } finally {
          await db.destroy();
     }
}

runMigrations();