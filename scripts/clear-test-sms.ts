import { db } from '../apps/backend/src/db/client';
import { smsMessages } from '../apps/backend/src/db/schema';
import { sql } from 'drizzle-orm';

async function main() {
  await db.execute(sql`DELETE FROM sms_messages`);
  const count = (await db.query.smsMessages.findMany()).length;
  console.log('smsMessages in DB:', count);
  process.exit(0);
}
main();
