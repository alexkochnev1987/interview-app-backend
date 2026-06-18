import { config } from 'dotenv';
import { resolve } from 'path';

/**
 * Loaded before other database modules so standalone scripts (migrate) see DATABASE_URL.
 * Nest apps use ConfigModule.forRoot(); migrate.ts runs outside Nest.
 */
config({ path: resolve(process.cwd(), '.env') });
