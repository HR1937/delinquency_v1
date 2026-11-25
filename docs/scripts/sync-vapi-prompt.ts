import { config } from '../../apps/backend/src/config';
import fs from 'fs';
import path from 'path';

async function syncPrompt() {
  const isConfirm = process.argv.includes('--confirm');
  console.log(`\n=== VAPI PROMPT SYNCHRONIZATION TOOL ===`);
  console.log(`Mode: ${isConfirm ? 'LIVE UPDATE (--confirm)' : 'DRY RUN (preview only)'}`);

  if (!config.VAPI_PRIVATE_API_KEY || !config.VAPI_ASSISTANT_ID) {
    console.error('ERROR: VAPI_PRIVATE_API_KEY or VAPI_ASSISTANT_ID is not configured in .env');
    process.exit(1);
  }

  // 1. Fetch current assistant configuration
  console.log(`Connecting to Vapi for assistant ID: ${config.VAPI_ASSISTANT_ID}...`);
  const res = await fetch(`https://api.vapi.ai/assistant/${config.VAPI_ASSISTANT_ID}`, {
    headers: {
      'Authorization': `Bearer ${config.VAPI_PRIVATE_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  if (!res.ok) {
    console.error(`Failed to fetch assistant (Status ${res.status}): ${await res.text()}`);
    process.exit(1);
  }

  const assistant = await res.json();
  console.log(`Target assistant verified: "${assistant.name}" (Model: ${assistant.model?.model || 'default'})`);

  const promptPath = path.resolve(import.meta.dir, '../VAPI_SYSTEM_PROMPT.md');
  const newPrompt = fs.readFileSync(promptPath, 'utf8');

  console.log(`\nLoaded system prompt from docs/VAPI_SYSTEM_PROMPT.md (${newPrompt.length} characters)`);

  if (!isConfirm) {
    console.log('\n[DRY RUN PREVIEW] Assistant prompt is ready to sync.');
    console.log('To apply changes to the live Vapi assistant, run:');
    console.log('  bun run docs/scripts/sync-vapi-prompt.ts --confirm\n');
    return;
  }

  // Live update
  console.log('\nApplying prompt update to Vapi assistant...');
  const updateRes = await fetch(`https://api.vapi.ai/assistant/${config.VAPI_ASSISTANT_ID}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${config.VAPI_PRIVATE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: {
        ...assistant.model,
        messages: [
          {
            role: 'system',
            content: newPrompt
          }
        ]
      }
    })
  });

  if (!updateRes.ok) {
    console.error(`Update failed: ${await updateRes.text()}`);
    process.exit(1);
  }

  console.log('✓ Successfully synchronized system prompt to Vapi assistant!\n');
}

syncPrompt().catch(console.error);
