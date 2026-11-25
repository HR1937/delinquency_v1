import { db } from '../db/client';
import { sql } from 'drizzle-orm';

async function check() {
  const [loans] = await db.execute(sql`SELECT count(*)::int as count FROM loans WHERE loan_number NOT LIKE 'TEST-%'`);
  const [borrowers] = await db.execute(sql`SELECT count(*)::int as count FROM borrowers`);
  const [phones] = await db.execute(sql`SELECT count(*)::int as count FROM phone_numbers`);
  const [campaigns] = await db.execute(sql`SELECT count(*)::int as count FROM campaigns`);
  const [memberships] = await db.execute(sql`SELECT count(*)::int as count FROM campaign_members`);
  const [cbs] = await db.execute(sql`SELECT count(*)::int as count FROM callbacks`);
  const [calls] = await db.execute(sql`SELECT count(*)::int as count FROM call_attempts`);
  const [sms] = await db.execute(sql`SELECT count(*)::int as count FROM sms_messages`);
  const [webhooks] = await db.execute(sql`SELECT count(*)::int as count FROM provider_webhook_events`);
  const [outbox] = await db.execute(sql`SELECT count(*)::int as count FROM servicing_outbox`);
  const [jobs] = await db.execute(sql`SELECT count(*)::int as count FROM scheduled_jobs`);

  console.log('BASELINE DATABASE COUNTS:');
  console.log('Loans:', (loans as any).count);
  console.log('Borrowers:', (borrowers as any).count);
  console.log('Phones:', (phones as any).count);
  console.log('Campaigns:', (campaigns as any).count);
  console.log('Campaign Memberships:', (memberships as any).count);
  console.log('Callbacks:', (cbs as any).count);
  console.log('Call Attempts:', (calls as any).count);
  console.log('SMS Messages:', (sms as any).count);
  console.log('Webhook Events:', (webhooks as any).count);
  console.log('Servicing Outbox:', (outbox as any).count);
  console.log('Scheduled Jobs:', (jobs as any).count);
  process.exit(0);
}

check().catch(e => {
  console.error(e);
  process.exit(1);
});
