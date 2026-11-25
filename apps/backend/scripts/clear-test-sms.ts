import { db } from '../src/db/client';
import { sql } from 'drizzle-orm';

async function main() {
  await db.execute(sql`DELETE FROM sms_messages`);
  const count = (await db.query.smsMessages.findMany()).length;
  console.log('smsMessages in DB:', count);
  process.exit(0);
}
main();
