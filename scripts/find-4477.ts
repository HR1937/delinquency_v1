import { db } from '../apps/backend/src/db/client';
import { sql } from 'drizzle-orm';

async function search() {
  console.log('Searching all tables for 4477...');
  const res = await db.execute(sql`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE data_type IN ('text', 'character varying') 
    AND table_schema = 'public'
  `);

  for (const row of res as any[]) {
    try {
      const q: any = await db.execute(sql.raw(`SELECT "${row.column_name}" FROM "${row.table_name}" WHERE "${row.column_name}"::text LIKE '%4477%'`));
      if (q.length > 0) {
        console.log(`Found 4477 in table ${row.table_name}, column ${row.column_name}:`, q);
      }
    } catch (e) {}
  }
  
  console.log('Searching all tables for +91...');
  for (const row of res as any[]) {
    try {
      const q: any = await db.execute(sql.raw(`SELECT "${row.column_name}" FROM "${row.table_name}" WHERE "${row.column_name}"::text LIKE '%+91%'`));
      if (q.length > 0) {
        console.log(`Found +91 in table ${row.table_name}, column ${row.column_name}:`, q);
      }
    } catch (e) {}
  }
  
  console.log('Search completed.');
  process.exit(0);
}

search();
