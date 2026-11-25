import postgres from 'postgres';

const sql = postgres('postgresql://postgres:1937@localhost:5432/delinquency_poc');

// Reset all seeded phones' is_verified back to false
// (migration 25 incorrectly auto-verified all hygiene-verified phones)
// Only phones that were explicitly verified by an operator (not 'internal_team' via migration) should remain verified
// Since ALL verifications were done by migration as 'internal_team', we reset all.

const result = await sql`
  UPDATE phone_numbers
  SET 
    is_verified = false,
    verified_by = null,
    verified_at = null,
    verification_notes = null
  WHERE verified_by = 'internal_team' OR (is_verified = true AND is_seeded = true)
  RETURNING id, phone_e164, is_verified
`;

console.log(`Reset ${result.length} phones to is_verified=false`);

// Verify the state
const stats = await sql`SELECT COUNT(*) as total, COUNT(CASE WHEN is_verified THEN 1 END) as verified FROM phone_numbers`;
console.log('Post-reset:', JSON.stringify(stats[0]));

// Check how many Verified Contacts campaign members now have verified phones
const vcCampaign = await sql`
  SELECT c.id FROM campaigns c WHERE c.name = 'Verified Contacts'
`;
if (vcCampaign.length > 0) {
  const vcId = vcCampaign[0].id;
  const verifiedMembers = await sql`
    SELECT COUNT(*) as count
    FROM campaign_members cm
    JOIN loans l ON l.id = cm.loan_id
    JOIN phone_numbers p ON p.loan_id = l.id AND p.is_primary = true
    WHERE cm.campaign_id = ${vcId} AND p.is_verified = true
  `;
  console.log('Verified Contacts campaign - members with verified phones:', verifiedMembers[0].count);
  
  const totalMembers = await sql`SELECT COUNT(*) as count FROM campaign_members WHERE campaign_id = ${vcId}`;
  console.log('Verified Contacts campaign - total members:', totalMembers[0].count);
}

await sql.end();
console.log('Done.');
