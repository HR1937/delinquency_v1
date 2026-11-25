import postgres from 'postgres';
import { config } from '../config';
import { execSync } from 'child_process';

async function main() {
  console.log('--- Canonical Setup Sequence Verification on Disposable DB ---');

  // 1. Parse connection string
  const url = new URL(config.DATABASE_URL);
  const targetDbName = url.pathname.replace(/^\//, '');
  console.log(`Operational database name is: "${targetDbName}"`);

  // Connect to administrative 'postgres' database
  url.pathname = '/postgres';
  const adminSql = postgres(url.toString(), { max: 1 });

  // Clean any existing dangling disposable test databases from previous killed runs
  const existingDisposables = await adminSql`SELECT datname FROM pg_database WHERE datname LIKE 'delinquency_disposable_test_%'`;
  for (const row of existingDisposables) {
    if (row.datname.startsWith('delinquency_disposable_test_')) {
      await adminSql.unsafe(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${row.datname}' AND pid <> pg_backend_pid()`);
      await adminSql.unsafe(`DROP DATABASE IF EXISTS "${row.datname}"`);
      console.log(`Cleaned up prior dangling disposable test DB: ${row.datname}`);
    }
  }

  // 2. Generate disposable database name with strict assertion
  const randSuffix = Math.random().toString(36).substring(2, 8);
  const disposableDbName = `delinquency_disposable_test_${Date.now()}_${randSuffix}`;

  if (!disposableDbName.startsWith('delinquency_disposable_test_')) {
    throw new Error(`SAFETY ASSERTION FAILED: Invalid disposable DB name "${disposableDbName}"`);
  }
  if (disposableDbName === targetDbName || disposableDbName.includes('delinquency_poc')) {
    throw new Error(`SAFETY ASSERTION FAILED: Cannot target operational DB "${disposableDbName}"`);
  }

  console.log(`Creating disposable database: "${disposableDbName}"...`);
  await adminSql.unsafe(`CREATE DATABASE "${disposableDbName}"`);
  console.log('Disposable database created successfully.');

  const disposableUrl = new URL(config.DATABASE_URL);
  disposableUrl.pathname = `/${disposableDbName}`;
  const disposableConnStr = disposableUrl.toString();

  try {
    // 3. Test Bootstrap Sequence:
    // Step 1: Push schema via drizzle-kit with non-interactive flags
    console.log('Step 1: Pushing schema with drizzle-kit push...');
    execSync(`bunx drizzle-kit push --dialect postgresql --schema ./src/db/schema.ts --url "${disposableConnStr}" --force`, {
      cwd: 'apps/backend',
      env: { ...process.env, DATABASE_URL: disposableConnStr },
      stdio: 'pipe'
    });
    console.log('Schema push completed.');

    // Step 2: Run safe incremental migration
    console.log('Step 2: Running run-migration.ts...');
    execSync('bun src/db/run-migration.ts', {
      cwd: 'apps/backend',
      env: { ...process.env, DATABASE_URL: disposableConnStr },
      stdio: 'pipe'
    });
    console.log('Incremental migration completed.');

    // Step 3: Seed baseline data
    console.log('Step 3: Running seed.ts...');
    execSync('bun src/db/seed.ts', {
      cwd: 'apps/backend',
      env: { ...process.env, DATABASE_URL: disposableConnStr },
      stdio: 'pipe'
    });
    console.log('Seed completed.');

    // 4. Verify contents of the disposable database
    console.log('Step 4: Inspecting seeded records in disposable database...');
    const testSql = postgres(disposableConnStr, { max: 1 });
    const loans = await testSql`SELECT count(*)::int as count FROM loans WHERE loan_number LIKE 'LN-%'`;
    const campaigns = await testSql`SELECT count(*)::int as count FROM campaigns`;
    const members = await testSql`SELECT count(*)::int as count FROM campaign_members`;
    const callbacks = await testSql`SELECT count(*)::int as count, source_type FROM callbacks GROUP BY source_type`;
    const attempts = await testSql`SELECT count(*)::int as count FROM call_attempts`;

    console.log(`Disposable DB Verification Counts:
  - Baseline Loans (LN-*): ${loans[0].count} (Expected: 30)
  - Campaigns: ${campaigns[0].count} (Expected: 3)
  - Campaign Members: ${members[0].count} (Expected: 32)
  - Operational Call Attempts: ${attempts[0].count} (Expected: 0)
  - Callbacks by Source: ${JSON.stringify(callbacks)}`);

    if (loans[0].count !== 30 || campaigns[0].count !== 3 || members[0].count !== 32 || attempts[0].count !== 0) {
      throw new Error('Verification failed: Counts did not match expected baseline values!');
    }

    await testSql.end();
    console.log('Bootstrap verification on disposable database PASSED with 100% fidelity!');
  } finally {
    // 5. Clean up: Terminate connections and drop disposable database
    console.log(`Cleaning up: Dropping disposable database "${disposableDbName}"...`);
    // Terminate open connections to disposable DB
    await adminSql.unsafe(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = '${disposableDbName}' AND pid <> pg_backend_pid();
    `);
    // Ensure strict disposable assertion before drop
    if (disposableDbName.startsWith('delinquency_disposable_test_')) {
      await adminSql.unsafe(`DROP DATABASE IF EXISTS "${disposableDbName}"`);
      console.log(`Disposable database "${disposableDbName}" dropped cleanly.`);
    }
    await adminSql.end();
  }
}

main().catch(err => {
  console.error('Bootstrap test failed:', err);
  process.exit(1);
});
