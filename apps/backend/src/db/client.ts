import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Determine if running under test runner
const isTestEnv = process.env.NODE_ENV === 'test' ||
  (typeof Bun !== 'undefined' && Bun.env.NODE_ENV === 'test') ||
  process.env.TEST_DISPOSABLE_DB_OPT_IN === 'true';

const testEnvPath = path.resolve(process.cwd(), '.env.test');
const defaultEnvPath = path.resolve(process.cwd(), '.env');

if (isTestEnv && fs.existsSync(testEnvPath)) {
  dotenv.config({ path: testEnvPath, override: true });
} else if (fs.existsSync(defaultEnvPath)) {
  dotenv.config({ path: defaultEnvPath });
} else {
  dotenv.config({ path: '../../.env' });
}

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:1937@localhost:5432/delinquency_poc';

const queryClient = postgres(connectionString, { max: 10 });
export const db = drizzle(queryClient, { schema });
