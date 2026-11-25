import { db } from '../db/client';
import { sql } from 'drizzle-orm';

async function main() {
  const cols = await db.execute(sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'state_change_log'
    ORDER BY ordinal_position;
  `);
  console.log('Columns in state_change_log:');
  console.table(cols);

  process.exit(0);
}

main().catch(console.error);
