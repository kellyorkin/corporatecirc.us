// scripts/backfill-alignment.js
//
// One-shot backfill: replaces every card's `osi_layer` field with an `alignment`
// field, using the hardcoded map below. Run once after the V1.1 alignment swap
// PR lands the schema change in generate-card.js / flea.html / render-cards.js.
//
// Alignments were assigned by reading each card's full content and judging
// posture against the 10-value grid (see generate-card.js system prompt).
// Safe to re-run: idempotent on cards that already have `alignment` and no
// `osi_layer`.
//
// Usage (run from repo root):
//   node scripts/backfill-alignment.js

const fs = require('fs');
const path = require('path');

const CARDS_DIR = path.join(__dirname, '..', 'cards');

const ALIGNMENTS = {
  '2026-04-27-174445-the-unified-profile.json':     'Lawful Performative',
  '2026-04-27-174514-the-discovery.json':           'Lawful Performative',
  '2026-04-27-174845-the-discovery.json':           'Lawful Performative',
  '2026-04-27-175542-the-lakehouse.json':           'Chaotic Performative',
  '2026-04-27-180549-the-phantom-kickoff.json':     'Lawful Performative',
  '2026-04-27-180725-the-naming-ceremony.json':     'Lawful Performative',
  '2026-04-27-191516-the-reverse-etl.json':         'Neutral Pragmatic',
  '2026-04-27-192626-the-unraveling.json':          'Lawful Performative',
  '2026-04-27-193736-the-wrap.json':                'Lawful Resigned',
  '2026-04-27-202813-the-early-departure.json':     'Neutral Resigned',
  '2026-04-27-204718-the-requirements-document.json': 'Lawful Compliant',
  '2026-04-27-204945-the-risk-register.json':       'Lawful Compliant',
  '2026-04-27-205634-the-checklist.json':           'Lawful Compliant',
  '2026-04-27-205912-the-t-shirt.json':             'Lawful Performative',
  '2026-04-27-210334-the-agility.json':             'Lawful Performative',
  '2026-04-27-210601-the-pivot.json':               'Chaotic Captured',
  '2026-04-27-211123-the-proof-of-concept.json':    'Lawful Performative',
  '2026-04-27-211546-the-feedback-loop.json':       'Chaotic Volatile',
  '2026-04-27-212235-the-masterpiece.json':         'Neutral Performative',
  '2026-04-27-213746-the-unified-profile.json':     'Lawful Performative',
  '2026-04-27-214145-the-design-review.json':       'Lawful Performative',
  '2026-04-27-222012-the-sponsored-moment.json':    'Chaotic Performative',
  '2026-04-27-222206-the-orchestrator.json':        'Lawful Resigned',
  '2026-04-27-222339-the-ai-first-mandate.json':    'Chaotic Performative',
  '2026-04-27-222444-the-scorecard.json':           'Lawful Performative',
  '2026-04-27-222630-the-channel-distinction.json': 'Lawful Performative',
  '2026-04-27-222747-the-vibe-coder.json':          'Chaotic Volatile',
  '2026-04-27-222849-the-legacy-system.json':       'Neutral Resigned',
  '2026-04-27-222953-the-legacy-user.json':         'Neutral Resigned',
  '2026-04-27-223043-the-user-group.json':          'Lawful Performative',
  '2026-04-27-223224-the-focus-group.json':         'Lawful Performative',
  '2026-04-27-223348-the-trade-show.json':          'Lawful Performative',
  '2026-04-27-223456-the-thought-leader.json':      'Chaotic Performative',
  '2026-04-28-134039-the-booth-gorgon.json':        'Lawful Performative',
  '2026-04-28-134404-the-demo-daemon.json':         'Chaotic Performative',
  '2026-04-28-180336-the-blue.json':                'Chaotic Volatile',
  '2026-04-28-180432-the-customer-360.json':        'Lawful Performative',
  '2026-04-28-193050-the-button-click.json':        'Lawful Performative',
  '2026-04-28-223500-the-acqui-hire.json':          'Chaotic Captured',
  '2026-04-29-134744-the-conversion.json':          'Chaotic Captured',
  '2026-04-29-213653-the-unsigned-draft.json':      'Lawful Resigned',
  '2026-04-30-120014-the-calculating-horse.json':   'Lawful Performative',
  '2026-04-30-120047-the-mustache.json':            'Lawful Performative',
  '2026-04-30-143349-the-living-document.json':     'Lawful Compliant',
  '2026-04-30-155921-the-prerequisite.json':        'Lawful Compliant',
  '2026-05-01-183820-the-student-centered-learning.json': 'Lawful Performative',
  '2026-05-01-190857-the-highlighted-section.json': 'Lawful Performative',
  '2026-05-02-004637-the-national-electric-code.json': 'Lawful Performative',
  '2026-05-05-212511-the-synthesis-reinvocation.json': 'Lawful Performative',
  '2026-05-06-142412-the-out-of-scope-introspection.json': 'Lawful Resigned',
};

// Walk every JSON in cards/ and rewrite. Place `alignment` in the exact slot
// where `osi_layer` used to live, so the field order stays predictable.
const files = fs.readdirSync(CARDS_DIR).filter(f => f.endsWith('.json')).sort();

let updated = 0;
let skipped = 0;
const unmapped = [];

for (const file of files) {
  if (!(file in ALIGNMENTS)) {
    unmapped.push(file);
    continue;
  }

  const fullPath = path.join(CARDS_DIR, file);
  const card = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));

  if (card.alignment && !card.osi_layer) {
    skipped++;
    continue;
  }

  const next = {};
  for (const [key, value] of Object.entries(card)) {
    if (key === 'osi_layer') {
      next.alignment = ALIGNMENTS[file];
      continue;
    }
    if (key === 'alignment') {
      // Card had alignment already; replace from map so re-runs converge.
      next.alignment = ALIGNMENTS[file];
      continue;
    }
    next[key] = value;
  }
  // If the card never had osi_layer (somehow) and didn't have alignment, append.
  if (!('alignment' in next)) {
    next.alignment = ALIGNMENTS[file];
  }

  fs.writeFileSync(fullPath, JSON.stringify(next, null, 2) + '\n');
  updated++;
}

console.log(`Updated:  ${updated}`);
console.log(`Skipped:  ${skipped} (already migrated)`);
if (unmapped.length) {
  console.log(`UNMAPPED: ${unmapped.length} — these files have no entry in ALIGNMENTS:`);
  for (const f of unmapped) console.log(`  ${f}`);
  process.exit(1);
}
