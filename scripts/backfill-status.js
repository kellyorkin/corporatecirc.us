// scripts/backfill-status.js
//
// One-time migration: walks every card in cards/*.json and adds
// "status": "published" to any card that does not already have the field.
//
// Existing cards are already canonical (visible on the live venue pages),
// so they are marked "published" — the render pipeline will not re-process them.
// New cards saved going forward will default to "draft" (set by save-card.js)
// and will be picked up by the render pipeline.
//
// Usage (run from repo root):
//   node scripts/backfill-status.js
//
// Idempotent — safe to run multiple times. Cards that already have status
// are left untouched.

const fs = require('fs');
const path = require('path');

const cardsDir = path.join(__dirname, '..', 'cards');

if (!fs.existsSync(cardsDir)) {
  console.error(`No cards directory found at ${cardsDir}`);
  process.exit(1);
}

const files = fs.readdirSync(cardsDir).filter(f => f.endsWith('.json'));

let updated = 0;
let skipped = 0;
let errors = 0;

for (const file of files) {
  const fullPath = path.join(cardsDir, file);
  try {
    const raw = fs.readFileSync(fullPath, 'utf-8');
    const card = JSON.parse(raw);

    if (card.status) {
      skipped++;
      continue;
    }

    card.status = 'published';
    fs.writeFileSync(fullPath, JSON.stringify(card, null, 2) + '\n');
    updated++;
  } catch (err) {
    console.error(`Error processing ${file}: ${err.message}`);
    errors++;
  }
}

console.log('');
console.log('Backfill complete.');
console.log(`  Updated: ${updated} card(s) → status: "published"`);
console.log(`  Skipped: ${skipped} card(s) (already had status)`);
if (errors > 0) {
  console.log(`  Errors:  ${errors} card(s) — see messages above`);
}
console.log('');
console.log('Next: review the diff (git diff cards/), then commit.');
